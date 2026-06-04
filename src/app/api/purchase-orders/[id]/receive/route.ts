import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders, poLineItems, goodsReceipts, goodsReceiptLines } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { receiveGoodsSchema } from "@/lib/validations";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

const RECEIVABLE = new Set(["approved", "sent", "partially_received"]);

// POST /api/purchase-orders/[id]/receive — record a goods receipt (GRN).
// Bumps each line's qtyReceived and advances PO status. The inventory
// stock-ledger consumer (Phase 3) reacts to the emitted `po.received`.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!po) return notFound();
    if (!(await hasModuleAccess(po.workspaceId, session.user.id, "canAccessPurchasing", session.user.role)))
      return forbidden();
    if (!RECEIVABLE.has(po.status)) return conflict(`Cannot receive a ${po.status} purchase order`);

    const input = receiveGoodsSchema.parse(await req.json());
    const lines = await db.select().from(poLineItems).where(eq(poLineItems.purchaseOrderId, id));
    const byId = new Map(lines.map((l) => [l.id, l]));

    // Validate every received line belongs to this PO and isn't over-received.
    for (const r of input.lines) {
      const line = byId.get(r.poLineItemId);
      if (!line) return badRequest(`Line ${r.poLineItemId} is not on this purchase order`);
      if (line.qtyReceived + r.quantity > line.quantity + 1e-9)
        return badRequest(`Received quantity exceeds ordered quantity for "${line.description}"`);
    }

    const result = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: po.workspaceId, docType: "goods_receipt" });
      const [grn] = await tx
        .insert(goodsReceipts)
        .values({
          workspaceId: po.workspaceId,
          purchaseOrderId: id,
          docNumber,
          warehouseId: input.warehouseId || null,
          receivedBy: session.user.id,
          notes: input.notes || null,
        })
        .returning();

      await tx.insert(goodsReceiptLines).values(
        input.lines.map((r) => ({
          goodsReceiptId: grn.id,
          poLineItemId: r.poLineItemId,
          productId: byId.get(r.poLineItemId)?.productId ?? null,
          quantity: r.quantity,
        }))
      );

      // Apply received quantities and recompute fulfilment.
      const received = new Map<string, number>();
      for (const r of input.lines) received.set(r.poLineItemId, (received.get(r.poLineItemId) ?? 0) + r.quantity);
      let allReceived = true;
      for (const line of lines) {
        const add = received.get(line.id) ?? 0;
        const newQty = line.qtyReceived + add;
        if (add > 0) {
          await tx.update(poLineItems).set({ qtyReceived: newQty }).where(eq(poLineItems.id, line.id));
        }
        if (newQty < line.quantity - 1e-9) allReceived = false;
      }

      const newStatus = allReceived ? "received" : "partially_received";
      await tx
        .update(purchaseOrders)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id));

      await emitEvent(tx, {
        workspaceId: po.workspaceId,
        eventType: "po.received",
        aggregateType: "purchase_order",
        aggregateId: po.id,
        actorUserId: session.user.id,
        payload: {
          docNumber: po.docNumber,
          goodsReceiptId: grn.id,
          vendorId: po.vendorId,
          boardId: po.boardId,
          itemId: po.itemId,
          lines: input.lines,
          fullyReceived: allReceived,
        },
      });

      return { grnId: grn.id, grnDocNumber: docNumber, status: newStatus };
    });

    dispatchInline();
    return ok(result);
  }, { route: "POST /api/purchase-orders/[id]/receive" });
}
