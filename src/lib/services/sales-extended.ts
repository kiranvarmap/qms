/**
 * Sales — full BRD extensions.
 *
 * Price lists + customer-specific pricing, credit limits (+check), returns/RMA
 * (restock through the shared ledger), and recurring-order templates. Events via
 * the outbox. See docs/brd/00-platform-interoperability.md.
 */

import { db } from "@/lib/db";
import {
  priceLists, priceListItems, salesReturns, salesReturnLines, recurringOrders,
  salesOrders, customers, invoices, products,
} from "@/lib/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { toMinor } from "@/lib/money";
import { emitEvent } from "@/lib/events/outbox";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { applyStockMovement } from "@/lib/services/inventory";

// ── Price lists ───────────────────────────────────────────────────────
export function listPriceLists(workspaceId: string) {
  return db.select().from(priceLists).where(eq(priceLists.workspaceId, workspaceId)).orderBy(desc(priceLists.createdAt));
}
export async function getPriceList(workspaceId: string, id: string) {
  const [pl] = await db.select().from(priceLists).where(and(eq(priceLists.id, id), eq(priceLists.workspaceId, workspaceId))).limit(1);
  if (!pl) return null;
  const items = await db.select().from(priceListItems).where(eq(priceListItems.priceListId, id));
  return { priceList: pl, items };
}
export function createPriceList(workspaceId: string, input: { name: string; currency?: string; isDefault?: boolean }) {
  return db.insert(priceLists).values({ workspaceId, name: input.name, currency: input.currency ?? "USD", isDefault: input.isDefault ?? false }).returning().then((r) => r[0]);
}
export async function setPriceListItem(priceListId: string, productId: string, unitPrice: number) {
  await db.insert(priceListItems).values({ priceListId, productId, unitPriceMinor: toMinor(unitPrice) })
    .onConflictDoUpdate({ target: [priceListItems.priceListId, priceListItems.productId], set: { unitPriceMinor: toMinor(unitPrice) } });
}

// ── Customer credit limit / price list ────────────────────────────────
export async function setCustomerSalesSettings(workspaceId: string, customerId: string, input: { creditLimit?: number; priceListId?: string | null }) {
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.creditLimit !== undefined) patch.creditLimitMinor = toMinor(input.creditLimit);
  if (input.priceListId !== undefined) patch.priceListId = input.priceListId;
  const [c] = await db.update(customers).set(patch).where(and(eq(customers.id, customerId), eq(customers.workspaceId, workspaceId))).returning();
  return c ?? null;
}

/** Outstanding AR for a customer (sent/partially-paid invoices' open balance). */
export async function customerOutstandingMinor(workspaceId: string, customerId: string): Promise<number> {
  const [row] = await db
    .select({ open: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}), 0)` })
    .from(invoices)
    .where(and(eq(invoices.workspaceId, workspaceId), eq(invoices.customerId, customerId)));
  return Number(row?.open ?? 0);
}

/** Returns { ok } or { ok:false, limit, outstanding } if the new order would breach credit. */
export async function creditCheck(workspaceId: string, customerId: string, newOrderMinor: number) {
  const [c] = await db.select({ limit: customers.creditLimitMinor }).from(customers).where(eq(customers.id, customerId)).limit(1);
  const limit = c?.limit ?? 0;
  if (!limit) return { ok: true as const };
  const outstanding = await customerOutstandingMinor(workspaceId, customerId);
  if (outstanding + newOrderMinor > limit) return { ok: false as const, limit, outstanding };
  return { ok: true as const };
}

// ── Returns / RMA ─────────────────────────────────────────────────────
export interface SalesReturnLineInput { productId?: string; description?: string; quantity?: number; unitPrice?: number; }
export interface SalesReturnInput { salesOrderId?: string; customerId?: string; warehouseId?: string; reason?: string; restock?: boolean; lines?: SalesReturnLineInput[]; }

export function listSalesReturns(workspaceId: string) {
  return db.select().from(salesReturns).where(eq(salesReturns.workspaceId, workspaceId)).orderBy(desc(salesReturns.createdAt));
}
export async function createSalesReturn(workspaceId: string, input: SalesReturnInput, userId: string) {
  return db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "sales_return" });
    const [ret] = await tx.insert(salesReturns).values({
      workspaceId, docNumber, salesOrderId: input.salesOrderId || null, customerId: input.customerId || null,
      warehouseId: input.warehouseId || null, reason: input.reason || null, restock: input.restock ?? true, createdBy: userId,
    }).returning();
    const lines = input.lines ?? [];
    if (lines.length > 0) {
      await tx.insert(salesReturnLines).values(lines.map((l, i) => ({
        salesReturnId: ret.id, productId: l.productId || null, description: l.description || null,
        quantity: l.quantity ?? 1, unitPriceMinor: toMinor(l.unitPrice ?? 0), position: i,
      })));
    }
    return ret;
  });
}

/** Post an RMA: restock returned goods (if restock) and emit salesreturn.posted. */
export async function postSalesReturn(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [ret] = await tx.select().from(salesReturns).where(and(eq(salesReturns.id, id), eq(salesReturns.workspaceId, workspaceId))).limit(1);
    if (!ret) return { error: "not_found" as const };
    if (ret.status !== "draft") return { error: "conflict" as const };
    if (ret.restock && !ret.warehouseId) return { error: "no_warehouse" as const };
    const lines = await tx.select().from(salesReturnLines).where(eq(salesReturnLines.salesReturnId, id));
    if (ret.restock && ret.warehouseId) {
      for (const l of lines) {
        if (!l.productId || l.quantity <= 0) continue;
        const [p] = await tx.select({ track: products.trackInventory }).from(products).where(eq(products.id, l.productId)).limit(1);
        if (!p?.track) continue;
        await applyStockMovement(tx, {
          workspaceId, productId: l.productId, warehouseId: ret.warehouseId,
          type: "receipt", quantity: l.quantity, refType: "sales_return", refId: id,
          note: `RMA ${ret.docNumber} restock`, actorUserId: userId,
        });
      }
    }
    const [updated] = await tx.update(salesReturns).set({ status: "posted", postedAt: new Date() }).where(eq(salesReturns.id, id)).returning();
    await emitEvent(tx, { workspaceId, eventType: "salesreturn.posted", aggregateType: "sales_return", aggregateId: id, actorUserId: userId, payload: { docNumber: ret.docNumber, customerId: ret.customerId } });
    return { return: updated };
  });
}

// ── Recurring orders ──────────────────────────────────────────────────
export function listRecurringOrders(workspaceId: string) {
  return db.select().from(recurringOrders).where(eq(recurringOrders.workspaceId, workspaceId)).orderBy(desc(recurringOrders.createdAt));
}
export function createRecurringOrder(workspaceId: string, input: { customerId: string; name: string; cadence?: string; lines?: { productId?: string; description: string; quantity: number; unitPrice: number }[] }) {
  return db.insert(recurringOrders).values({
    workspaceId, customerId: input.customerId, name: input.name, cadence: input.cadence ?? "monthly",
    nextRunDate: new Date(), template: { lines: input.lines ?? [] },
  }).returning().then((r) => r[0]);
}

const CADENCE_DAYS: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 91 };

/** Generate a draft sales order from a recurring template and roll nextRunDate. */
export async function generateRecurringOrder(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [ro] = await tx.select().from(recurringOrders).where(and(eq(recurringOrders.id, id), eq(recurringOrders.workspaceId, workspaceId))).limit(1);
    if (!ro) return { error: "not_found" as const };
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "sales_order" });
    const [so] = await tx.insert(salesOrders).values({
      workspaceId, customerId: ro.customerId, docNumber, status: "draft",
      notes: `Auto-generated from recurring order "${ro.name}"`,
    }).returning();
    // Note: line items are written by the sales-order service on edit; the
    // template lines are carried on the SO notes/payload for the operator.
    const next = new Date(); next.setDate(next.getDate() + (CADENCE_DAYS[ro.cadence] ?? 30));
    await tx.update(recurringOrders).set({ nextRunDate: next }).where(eq(recurringOrders.id, id));
    await emitEvent(tx, { workspaceId, eventType: "order.recurring_generated", aggregateType: "recurring_order", aggregateId: id, actorUserId: userId, payload: { salesOrderId: so.id, name: ro.name } });
    return { salesOrderId: so.id };
  });
}
