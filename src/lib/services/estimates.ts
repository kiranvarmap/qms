/**
 * Estimate helpers (Plan §6.1).
 *
 * Shared line-item + totals math for estimates (mirrors purchasing.ts but
 * quotes sell prices, not costs). All money in integer minor units; `unitPrice`
 * arrives in major units from the API boundary. Tax from each line's tax_rate.
 */

import { db } from "@/lib/db";
import { estimateLineItems, estimates, taxRates } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { toMinor, taxOf, sumMinor } from "@/lib/money";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface EstimateLineInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number; // major units
  taxRateId?: string;
}

/** Header-level money adjustments (Zoho parity). All "value"/major-unit inputs. */
export interface EstimateAdjustments {
  discountType?: "percent" | "amount";
  discountValue?: number;            // percent (0-100) or major-unit amount
  withholdingType?: "tds" | "tcs" | null;
  withholdingTaxRateId?: string | null;
  adjustment?: number;               // signed, major units
  roundOff?: number;                 // signed, major units
}

/** Replace an estimate's lines and recompute its stored totals (minor units). */
export async function writeEstimateLinesAndTotals(
  tx: Tx,
  workspaceId: string,
  estimateId: string,
  lines: EstimateLineInput[],
  adj: EstimateAdjustments = {}
): Promise<{ subtotalMinor: number; taxMinor: number; totalMinor: number }> {
  const taxIds = [...new Set(lines.map((l) => l.taxRateId).filter(Boolean) as string[])];
  if (adj.withholdingTaxRateId) taxIds.push(adj.withholdingTaxRateId);
  const rateMap = new Map<string, number>();
  if (taxIds.length > 0) {
    const rows = await tx.select().from(taxRates).where(inArray(taxRates.id, taxIds));
    for (const r of rows) if (r.workspaceId === workspaceId) rateMap.set(r.id, r.rateBasisPoints);
  }

  await tx.delete(estimateLineItems).where(eq(estimateLineItems.estimateId, estimateId));

  const nets: number[] = [];
  const taxes: number[] = [];
  const values = lines.map((l, i) => {
    const unitPriceMinor = toMinor(l.unitPrice);
    const net = Math.round(l.quantity * unitPriceMinor);
    const bp = l.taxRateId ? rateMap.get(l.taxRateId) ?? 0 : 0;
    const tax = taxOf(net, bp);
    nets.push(net);
    taxes.push(tax);
    return {
      estimateId,
      productId: l.productId ?? null,
      description: l.description,
      quantity: l.quantity,
      unitPriceMinor,
      taxRateId: l.taxRateId ?? null,
      amountMinor: net,
      lineTaxMinor: tax,
      position: i,
    };
  });

  if (values.length > 0) await tx.insert(estimateLineItems).values(values);

  const subtotalMinor = sumMinor(nets);
  const taxMinor = sumMinor(taxes);

  // Header adjustments: discount → withholding (TDS−/TCS+) → adjustment → round off.
  const discountType = adj.discountType ?? "percent";
  const discountValue = adj.discountValue ?? 0;
  const discountMinor = discountType === "amount"
    ? toMinor(discountValue)
    : Math.round((subtotalMinor * discountValue) / 100);
  const baseMinor = subtotalMinor - discountMinor;
  const whBp = adj.withholdingTaxRateId ? rateMap.get(adj.withholdingTaxRateId) ?? 0 : 0;
  const withholdingMinor = adj.withholdingType ? taxOf(baseMinor, whBp) : 0;
  const adjustmentMinor = adj.adjustment ? toMinor(adj.adjustment) : 0;
  const roundOffMinor = adj.roundOff ? toMinor(adj.roundOff) : 0;
  const whSign = adj.withholdingType === "tcs" ? 1 : adj.withholdingType === "tds" ? -1 : 0;
  const totalMinor = baseMinor + taxMinor + whSign * withholdingMinor + adjustmentMinor + roundOffMinor;

  await tx
    .update(estimates)
    .set({
      subtotalMinor, taxMinor, totalMinor,
      discountType, discountValue, discountMinor,
      withholdingType: adj.withholdingType ?? null,
      withholdingTaxRateId: adj.withholdingTaxRateId ?? null,
      withholdingMinor,
      adjustmentMinor, roundOffMinor,
      updatedAt: new Date(),
    })
    .where(eq(estimates.id, estimateId));

  return { subtotalMinor, taxMinor, totalMinor };
}
