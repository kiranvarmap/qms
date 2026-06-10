/**
 * Sales-order helpers (Plan §6.2).
 *
 * Shared line-item + totals math for sales orders (sell prices, minor units).
 * Mirrors estimates.ts; `unitPrice` arrives in major units from the API.
 */

import { db } from "@/lib/db";
import { salesOrderLineItems, salesOrders, taxRates, products } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { toMinor, taxOf, sumMinor } from "@/lib/money";
import { applyStockMovement } from "@/lib/services/inventory";
import { emitEvent } from "@/lib/events/outbox";
import type { EstimateAdjustments } from "./estimates";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface SalesOrderLineInput {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number; // major units
  taxRateId?: string;
}

/** Replace a sales order's lines and recompute its stored totals (minor units). */
export async function writeSalesOrderLinesAndTotals(
  tx: Tx,
  workspaceId: string,
  salesOrderId: string,
  lines: SalesOrderLineInput[],
  adj: EstimateAdjustments = {}
): Promise<{ subtotalMinor: number; taxMinor: number; totalMinor: number }> {
  const taxIds = [...new Set(lines.map((l) => l.taxRateId).filter(Boolean) as string[])];
  if (adj.withholdingTaxRateId) taxIds.push(adj.withholdingTaxRateId);
  const rateMap = new Map<string, number>();
  if (taxIds.length > 0) {
    const rows = await tx.select().from(taxRates).where(inArray(taxRates.id, taxIds));
    for (const r of rows) if (r.workspaceId === workspaceId) rateMap.set(r.id, r.rateBasisPoints);
  }

  await tx.delete(salesOrderLineItems).where(eq(salesOrderLineItems.salesOrderId, salesOrderId));

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
      salesOrderId,
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

  if (values.length > 0) await tx.insert(salesOrderLineItems).values(values);

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
    .update(salesOrders)
    .set({
      subtotalMinor, taxMinor, totalMinor, discountType, discountValue, discountMinor,
      withholdingType: adj.withholdingType ?? null, withholdingTaxRateId: adj.withholdingTaxRateId ?? null,
      withholdingMinor, adjustmentMinor, roundOffMinor, updatedAt: new Date(),
    })
    .where(eq(salesOrders.id, salesOrderId));

  return { subtotalMinor, taxMinor, totalMinor };
}

/**
 * Approve a sales order and reserve stock for its tracked lines (Plan §6.3:
 * committed+ only; on-hand leaves at shipment). Callable from the direct
 * approve route AND the approval-engine subject sync, so both paths share one
 * implementation. Status guard makes it idempotent: only draft/
 * pending_approval orders transition.
 */
export async function reserveAndApproveSalesOrder(
  workspaceId: string,
  salesOrderId: string,
  actorUserId: string | null
): Promise<{ ok: true; status: "reserved" } | { error: "not_found" | "conflict" | "warehouse_required" }> {
  const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, salesOrderId)).limit(1);
  if (!so || so.workspaceId !== workspaceId) return { error: "not_found" };
  if (so.status !== "draft" && so.status !== "pending_approval") return { error: "conflict" };

  const lines = await db.select().from(salesOrderLineItems).where(eq(salesOrderLineItems.salesOrderId, salesOrderId));
  const productIds = lines.map((l) => l.productId).filter(Boolean) as string[];
  const trackedIds = new Set<string>();
  if (productIds.length > 0) {
    const prods = await db.select().from(products).where(inArray(products.id, productIds));
    for (const p of prods) if (p.trackInventory) trackedIds.add(p.id);
  }
  const trackedLines = lines.filter((l) => l.productId && trackedIds.has(l.productId));
  if (trackedLines.length > 0 && !so.warehouseId) return { error: "warehouse_required" };

  await db.transaction(async (tx) => {
    for (const line of trackedLines) {
      const toReserve = line.quantity - line.qtyReserved;
      if (toReserve <= 0) continue;
      await applyStockMovement(tx, {
        workspaceId: so.workspaceId,
        productId: line.productId!,
        warehouseId: so.warehouseId!,
        type: "reservation",
        quantity: toReserve,
        refType: "sales_order",
        refId: so.id,
        actorUserId,
      });
      await tx.update(salesOrderLineItems).set({ qtyReserved: line.quantity }).where(eq(salesOrderLineItems.id, line.id));
    }

    await tx
      .update(salesOrders)
      .set({ status: "reserved", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(salesOrders.id, salesOrderId));

    await emitEvent(tx, {
      workspaceId: so.workspaceId,
      eventType: "salesorder.approved",
      aggregateType: "sales_order",
      aggregateId: so.id,
      actorUserId,
      payload: { docNumber: so.docNumber, customerId: so.customerId, boardId: so.boardId, itemId: so.itemId },
    });
  });

  return { ok: true, status: "reserved" };
}
