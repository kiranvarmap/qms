/**
 * Purchasing — full BRD extensions.
 *
 * Purchase requisitions (→ PO), landed-cost allocation, returns/debit notes
 * (relieve stock), and a 3-way match summary (PO ↔ GRN ↔ invoice). Stock
 * changes go through the shared ledger; events via the outbox.
 */

import { db } from "@/lib/db";
import {
  purchaseRequisitions, requisitionLines, poLandedCosts, purchaseReturns, purchaseReturnLines,
  purchaseOrders, poLineItems, products,
} from "@/lib/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { toMinor } from "@/lib/money";
import { emitEvent } from "@/lib/events/outbox";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { applyStockMovement } from "@/lib/services/inventory";
import { writePoLinesAndTotals } from "@/lib/services/purchasing";

// ── Requisitions ──────────────────────────────────────────────────────
export interface ReqLineInput { productId?: string; description: string; quantity?: number; estUnitCost?: number; }
export interface ReqInput { vendorId?: string; neededBy?: string; notes?: string; submit?: boolean; lines?: ReqLineInput[]; }

export function listRequisitions(workspaceId: string) {
  return db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.workspaceId, workspaceId)).orderBy(desc(purchaseRequisitions.createdAt));
}
export async function getRequisition(workspaceId: string, id: string) {
  const [req] = await db.select().from(purchaseRequisitions).where(and(eq(purchaseRequisitions.id, id), eq(purchaseRequisitions.workspaceId, workspaceId))).limit(1);
  if (!req) return null;
  const lines = await db.select().from(requisitionLines).where(eq(requisitionLines.requisitionId, id)).orderBy(asc(requisitionLines.position));
  return { requisition: req, lines };
}

export async function createRequisition(workspaceId: string, input: ReqInput, userId: string) {
  return db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "purchase_requisition" });
    const submitting = Boolean(input.submit);
    const [req] = await tx.insert(purchaseRequisitions).values({
      workspaceId, docNumber, status: submitting ? "submitted" : "draft",
      vendorId: input.vendorId || null, neededBy: input.neededBy ? new Date(input.neededBy) : null,
      notes: input.notes || null, requestedBy: userId,
    }).returning();
    const lines = input.lines ?? [];
    if (lines.length > 0) {
      await tx.insert(requisitionLines).values(lines.map((l, i) => ({
        requisitionId: req.id, productId: l.productId || null, description: l.description,
        quantity: l.quantity ?? 1, estUnitCostMinor: toMinor(l.estUnitCost ?? 0), position: i,
      })));
    }
    if (submitting) {
      await emitEvent(tx, { workspaceId, eventType: "requisition.submitted", aggregateType: "purchase_requisition", aggregateId: req.id, actorUserId: userId, payload: { docNumber } });
    }
    return req;
  });
}

export async function decideRequisition(workspaceId: string, id: string, decision: "approved" | "rejected", userId: string) {
  return db.transaction(async (tx) => {
    const [req] = await tx.select().from(purchaseRequisitions).where(and(eq(purchaseRequisitions.id, id), eq(purchaseRequisitions.workspaceId, workspaceId))).limit(1);
    if (!req) return null;
    const [updated] = await tx.update(purchaseRequisitions).set({ status: decision, approverId: userId, updatedAt: new Date() }).where(eq(purchaseRequisitions.id, id)).returning();
    await emitEvent(tx, { workspaceId, eventType: decision === "approved" ? "requisition.approved" : "requisition.rejected", aggregateType: "purchase_requisition", aggregateId: id, actorUserId: userId, payload: { docNumber: req.docNumber } });
    return updated;
  });
}

/** Convert an approved requisition into a draft PO (copies lines + totals). */
export async function convertRequisitionToPo(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [req] = await tx.select().from(purchaseRequisitions).where(and(eq(purchaseRequisitions.id, id), eq(purchaseRequisitions.workspaceId, workspaceId))).limit(1);
    if (!req) return { error: "not_found" as const };
    if (req.status !== "approved") return { error: "conflict" as const };
    if (!req.vendorId) return { error: "no_vendor" as const };
    const lines = await tx.select().from(requisitionLines).where(eq(requisitionLines.requisitionId, id));

    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "purchase_order" });
    const [po] = await tx.insert(purchaseOrders).values({
      workspaceId, vendorId: req.vendorId, docNumber, status: "draft", notes: req.notes,
    }).returning();
    await writePoLinesAndTotals(tx, workspaceId, po.id, lines.map((l) => ({
      productId: l.productId ?? undefined, description: l.description, quantity: l.quantity, unitCost: l.estUnitCostMinor / 100,
    })));
    await tx.update(purchaseRequisitions).set({ status: "converted", convertedPoId: po.id, updatedAt: new Date() }).where(eq(purchaseRequisitions.id, id));
    await emitEvent(tx, { workspaceId, eventType: "requisition.converted", aggregateType: "purchase_requisition", aggregateId: id, actorUserId: userId, payload: { purchaseOrderId: po.id } });
    return { purchaseOrderId: po.id };
  });
}

// ── Landed cost ───────────────────────────────────────────────────────
export function listLandedCosts(workspaceId: string, poId: string) {
  return db.select().from(poLandedCosts).where(and(eq(poLandedCosts.workspaceId, workspaceId), eq(poLandedCosts.purchaseOrderId, poId))).orderBy(asc(poLandedCosts.createdAt));
}
export function addLandedCost(workspaceId: string, poId: string, input: { costType?: string; amount?: number; note?: string }) {
  return db.insert(poLandedCosts).values({ workspaceId, purchaseOrderId: poId, costType: input.costType || "freight", amountMinor: toMinor(input.amount ?? 0), note: input.note || null }).returning().then((r) => r[0]);
}

// ── 3-way match summary (PO ↔ GRN; invoice leg via Invoicing module) ──
export async function threeWayMatch(workspaceId: string, poId: string) {
  const [po] = await db.select().from(purchaseOrders).where(and(eq(purchaseOrders.id, poId), eq(purchaseOrders.workspaceId, workspaceId))).limit(1);
  if (!po) return null;
  const lines = await db.select().from(poLineItems).where(eq(poLineItems.purchaseOrderId, poId));
  const orderedQty = lines.reduce((s, l) => s + l.quantity, 0);
  const receivedQty = lines.reduce((s, l) => s + l.qtyReceived, 0);
  const tol = po.overReceiptTolerancePct ?? 0;
  const fullyReceived = receivedQty >= orderedQty && receivedQty <= orderedQty * (1 + tol / 100);
  const status = receivedQty === 0 ? "unmatched" : fullyReceived ? "matched" : receivedQty > orderedQty * (1 + tol / 100) ? "exception" : "partial";
  await db.update(purchaseOrders).set({ matchStatus: status }).where(eq(purchaseOrders.id, poId));
  return { orderedQty, receivedQty, tolerancePct: tol, orderedValueMinor: po.totalMinor, status };
}

// ── Returns / debit notes ─────────────────────────────────────────────
export interface ReturnLineInput { productId?: string; description?: string; quantity?: number; unitCost?: number; }
export interface ReturnInput { purchaseOrderId?: string; vendorId?: string; warehouseId?: string; reason?: string; lines?: ReturnLineInput[]; }

export function listReturns(workspaceId: string) {
  return db.select().from(purchaseReturns).where(eq(purchaseReturns.workspaceId, workspaceId)).orderBy(desc(purchaseReturns.createdAt));
}
export async function getReturn(workspaceId: string, id: string) {
  const [ret] = await db.select().from(purchaseReturns).where(and(eq(purchaseReturns.id, id), eq(purchaseReturns.workspaceId, workspaceId))).limit(1);
  if (!ret) return null;
  const lines = await db.select().from(purchaseReturnLines).where(eq(purchaseReturnLines.purchaseReturnId, id)).orderBy(asc(purchaseReturnLines.position));
  return { return: ret, lines };
}

export async function createReturn(workspaceId: string, input: ReturnInput, userId: string) {
  return db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "purchase_return" });
    const [ret] = await tx.insert(purchaseReturns).values({
      workspaceId, docNumber, purchaseOrderId: input.purchaseOrderId || null, vendorId: input.vendorId || null,
      warehouseId: input.warehouseId || null, reason: input.reason || null, createdBy: userId,
    }).returning();
    const lines = input.lines ?? [];
    if (lines.length > 0) {
      await tx.insert(purchaseReturnLines).values(lines.map((l, i) => ({
        purchaseReturnId: ret.id, productId: l.productId || null, description: l.description || null,
        quantity: l.quantity ?? 1, unitCostMinor: toMinor(l.unitCost ?? 0), position: i,
      })));
    }
    return ret;
  });
}

/** Post a return: relieve stock for each tracked line and emit po.returned. */
export async function postReturn(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [ret] = await tx.select().from(purchaseReturns).where(and(eq(purchaseReturns.id, id), eq(purchaseReturns.workspaceId, workspaceId))).limit(1);
    if (!ret) return { error: "not_found" as const };
    if (ret.status !== "draft") return { error: "conflict" as const };
    if (!ret.warehouseId) return { error: "no_warehouse" as const };
    const lines = await tx.select().from(purchaseReturnLines).where(eq(purchaseReturnLines.purchaseReturnId, id));
    for (const l of lines) {
      if (!l.productId || l.quantity <= 0) continue;
      const [p] = await tx.select({ track: products.trackInventory }).from(products).where(eq(products.id, l.productId)).limit(1);
      if (!p?.track) continue;
      await applyStockMovement(tx, {
        workspaceId, productId: l.productId, warehouseId: ret.warehouseId,
        type: "adjustment", quantity: -l.quantity, refType: "purchase_return", refId: id,
        note: `Return ${ret.docNumber} to vendor`, actorUserId: userId,
      });
    }
    const [updated] = await tx.update(purchaseReturns).set({ status: "posted", postedAt: new Date() }).where(eq(purchaseReturns.id, id)).returning();
    await emitEvent(tx, { workspaceId, eventType: "po.returned", aggregateType: "purchase_return", aggregateId: id, actorUserId: userId, payload: { docNumber: ret.docNumber, vendorId: ret.vendorId } });
    return { return: updated };
  });
}
