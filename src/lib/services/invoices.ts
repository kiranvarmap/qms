/**
 * Invoice helpers (Plan §6).
 *
 * Shared line-item + totals math for invoices. Invoices are financial only —
 * no stock impact (Plan §6.3). `unitPrice` arrives in major units from the API
 * boundary; tax from each line's tax_rate. Lines may carry source provenance
 * (productId / timeLogId / salesOrderLineId).
 */

import { db } from "@/lib/db";
import { invoiceLineItems, invoices, taxRates } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { toMinor, taxOf, sumMinor } from "@/lib/money";
import type { EstimateAdjustments } from "./estimates";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface InvoiceLineInput {
  productId?: string;
  timeLogId?: string;
  salesOrderLineId?: string;
  description: string;
  quantity: number;
  unitPrice: number; // major units
  taxRateId?: string;
}

/** Replace an invoice's lines and recompute its stored totals (minor units). */
export async function writeInvoiceLinesAndTotals(
  tx: Tx,
  workspaceId: string,
  invoiceId: string,
  lines: InvoiceLineInput[],
  adj: EstimateAdjustments = {}
): Promise<{ subtotalMinor: number; taxMinor: number; totalMinor: number }> {
  const taxIds = [...new Set(lines.map((l) => l.taxRateId).filter(Boolean) as string[])];
  if (adj.withholdingTaxRateId) taxIds.push(adj.withholdingTaxRateId);
  const rateMap = new Map<string, number>();
  if (taxIds.length > 0) {
    const rows = await tx.select().from(taxRates).where(inArray(taxRates.id, taxIds));
    for (const r of rows) if (r.workspaceId === workspaceId) rateMap.set(r.id, r.rateBasisPoints);
  }

  await tx.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));

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
      invoiceId,
      productId: l.productId ?? null,
      timeLogId: l.timeLogId ?? null,
      salesOrderLineId: l.salesOrderLineId ?? null,
      description: l.description,
      quantity: l.quantity,
      unitPriceMinor,
      taxRateId: l.taxRateId ?? null,
      amountMinor: net,
      lineTaxMinor: tax,
      position: i,
    };
  });

  if (values.length > 0) await tx.insert(invoiceLineItems).values(values);

  const subtotalMinor = sumMinor(nets);
  const taxMinor = sumMinor(taxes);

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
    .update(invoices)
    .set({
      subtotalMinor, taxMinor, totalMinor, discountType, discountValue, discountMinor,
      withholdingType: adj.withholdingType ?? null, withholdingTaxRateId: adj.withholdingTaxRateId ?? null,
      withholdingMinor, adjustmentMinor, roundOffMinor, updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId));

  return { subtotalMinor, taxMinor, totalMinor };
}

/** Map an amount-paid vs. total to a payment status (excludes void/overdue). */
export function paymentStatus(amountPaidMinor: number, totalMinor: number): "sent" | "partially_paid" | "paid" {
  if (amountPaidMinor >= totalMinor && totalMinor > 0) return "paid";
  if (amountPaidMinor > 0) return "partially_paid";
  return "sent";
}
