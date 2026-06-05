import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesOrders, salesOrderLineItems, products } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { applyStockMovement } from "@/lib/services/inventory";
import { creditCheck } from "@/lib/services/sales-extended";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/sales-orders/[id]/approve — approve and RESERVE stock (Plan §6.3):
// each tracked line raises `committed` (available drops) without touching
// on-hand. On-hand only leaves at shipment. Pass ?override=true to bypass a
// customer credit-limit breach (Sales full BRD).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
    if (!so) return notFound();
    if (!(await hasModuleAccess(so.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (so.status !== "draft" && so.status !== "pending_approval")
      return conflict("Only draft sales orders can be approved");

    // Credit-limit check (skippable with ?override=true).
    if (new URL(req.url).searchParams.get("override") !== "true") {
      const credit = await creditCheck(so.workspaceId, so.customerId, so.totalMinor);
      if (!credit.ok)
        return conflict(`Credit limit exceeded: outstanding ${(credit.outstanding / 100).toFixed(2)} + order ${(so.totalMinor / 100).toFixed(2)} > limit ${(credit.limit / 100).toFixed(2)}. Approve with override to proceed.`);
    }

    const lines = await db.select().from(salesOrderLineItems).where(eq(salesOrderLineItems.salesOrderId, id));
    const productIds = lines.map((l) => l.productId).filter(Boolean) as string[];
    const trackedIds = new Set<string>();
    if (productIds.length > 0) {
      const prods = await db.select().from(products).where(inArray(products.id, productIds));
      for (const p of prods) if (p.trackInventory) trackedIds.add(p.id);
    }
    const trackedLines = lines.filter((l) => l.productId && trackedIds.has(l.productId));
    if (trackedLines.length > 0 && !so.warehouseId)
      return badRequest("Set a warehouse on the order before approving (stock will be reserved from it)");

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
          actorUserId: session.user.id,
        });
        await tx
          .update(salesOrderLineItems)
          .set({ qtyReserved: line.quantity })
          .where(eq(salesOrderLineItems.id, line.id));
      }

      await tx
        .update(salesOrders)
        .set({ status: "reserved", approvedAt: new Date(), updatedAt: new Date() })
        .where(eq(salesOrders.id, id));

      await emitEvent(tx, {
        workspaceId: so.workspaceId,
        eventType: "salesorder.approved",
        aggregateType: "sales_order",
        aggregateId: so.id,
        actorUserId: session.user.id,
        payload: { docNumber: so.docNumber, customerId: so.customerId, boardId: so.boardId, itemId: so.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "reserved" });
  }, { route: "POST /api/sales-orders/[id]/approve" });
}
