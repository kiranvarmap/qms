/**
 * Purchasing helpers (Plan §5).
 *
 * Shared line-item + totals math for purchase orders, so create and edit stay
 * in lock-step. All money is integer minor units (lib/money.ts); `unitCost`
 * arrives in major units from the API boundary and is converted here. Tax is
 * resolved from each line's referenced tax_rate basis points.
 */

import { db } from "@/lib/db";
import { poLineItems, purchaseOrders, taxRates } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { toMinor, taxOf, sumMinor } from "@/lib/money";
import type { EstimateAdjustments } from "./estimates";

/** A Drizzle transaction handle (same surface as `db`). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface PoLineInput {
  productId?: string;
  description: string;
  quantity: number;
  unitCost: number; // major units
  taxRateId?: string;
}

/**
 * Replace a PO's line items and recompute its stored totals, inside the given
 * transaction. Returns the rolled-up totals (minor units).
 */
export async function writePoLinesAndTotals(
  tx: Tx,
  workspaceId: string,
  purchaseOrderId: string,
  lines: PoLineInput[],
  adj: EstimateAdjustments = {}
): Promise<{ subtotalMinor: number; taxMinor: number; totalMinor: number }> {
  // Resolve referenced tax rates → basis points map (scoped to this workspace).
  const taxIds = [...new Set(lines.map((l) => l.taxRateId).filter(Boolean) as string[])];
  if (adj.withholdingTaxRateId) taxIds.push(adj.withholdingTaxRateId);
  const rateMap = new Map<string, number>();
  if (taxIds.length > 0) {
    const rows = await tx.select().from(taxRates).where(inArray(taxRates.id, taxIds));
    for (const r of rows) if (r.workspaceId === workspaceId) rateMap.set(r.id, r.rateBasisPoints);
  }

  await tx.delete(poLineItems).where(eq(poLineItems.purchaseOrderId, purchaseOrderId));

  const netAmounts: number[] = [];
  const taxAmounts: number[] = [];
  const values = lines.map((l, i) => {
    const unitCostMinor = toMinor(l.unitCost);
    const net = Math.round(l.quantity * unitCostMinor);
    const bp = l.taxRateId ? rateMap.get(l.taxRateId) ?? 0 : 0;
    const tax = taxOf(net, bp);
    netAmounts.push(net);
    taxAmounts.push(tax);
    return {
      purchaseOrderId,
      productId: l.productId ?? null,
      description: l.description,
      quantity: l.quantity,
      unitCostMinor,
      taxRateId: l.taxRateId ?? null,
      amountMinor: net,
      lineTaxMinor: tax,
      position: i,
    };
  });

  if (values.length > 0) await tx.insert(poLineItems).values(values);

  const subtotalMinor = sumMinor(netAmounts);
  const taxMinor = sumMinor(taxAmounts);

  const discountType = adj.discountType ?? "percent";
  const discountValue = adj.discountValue ?? 0;
  const discountMinor = discountType === "amount" ? toMinor(discountValue) : Math.round((subtotalMinor * discountValue) / 100);
  const baseMinor = subtotalMinor - discountMinor;
  const whBp = adj.withholdingTaxRateId ? rateMap.get(adj.withholdingTaxRateId) ?? 0 : 0;
  const withholdingMinor = adj.withholdingType ? taxOf(baseMinor, whBp) : 0;
  const adjustmentMinor = adj.adjustment ? toMinor(adj.adjustment) : 0;
  const roundOffMinor = adj.roundOff ? toMinor(adj.roundOff) : 0;
  const whSign = adj.withholdingType === "tcs" ? 1 : adj.withholdingType === "tds" ? -1 : 0;
  const totalMinor = baseMinor + taxMinor + whSign * withholdingMinor + adjustmentMinor + roundOffMinor;

  await tx
    .update(purchaseOrders)
    .set({
      subtotalMinor, taxMinor, totalMinor, discountType, discountValue, discountMinor,
      withholdingType: adj.withholdingType ?? null, withholdingTaxRateId: adj.withholdingTaxRateId ?? null,
      withholdingMinor, adjustmentMinor, roundOffMinor, updatedAt: new Date(),
    })
    .where(eq(purchaseOrders.id, purchaseOrderId));

  return { subtotalMinor, taxMinor, totalMinor };
}
