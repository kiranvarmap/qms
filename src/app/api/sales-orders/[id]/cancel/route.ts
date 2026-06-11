import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesOrders, salesOrderLineItems } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { applyStockMovement } from "@/lib/services/inventory";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

const BLOCKED = new Set(["shipped", "delivered", "invoiced", "cancelled"]);

// POST /api/sales-orders/[id]/cancel — cancel and RELEASE reservations
// (committed −qty back). Blocked once any goods have shipped.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
    if (!so) return notFound();
    if (!(await hasModuleAccess(so.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (BLOCKED.has(so.status)) return conflict(`Cannot cancel a ${so.status} sales order`);

    const lines = await db.select().from(salesOrderLineItems).where(eq(salesOrderLineItems.salesOrderId, id));

    await db.transaction(async (tx) => {
      for (const line of lines) {
        if (line.qtyReserved > 0 && line.productId && so.warehouseId) {
          await applyStockMovement(tx, {
            workspaceId: so.workspaceId,
            productId: line.productId,
            warehouseId: so.warehouseId,
            type: "reservation_release",
            quantity: line.qtyReserved,
            refType: "sales_order",
            refId: so.id,
            actorUserId: session.user.id,
          });
          await tx.update(salesOrderLineItems).set({ qtyReserved: 0 }).where(eq(salesOrderLineItems.id, line.id));
        }
      }

      await tx.update(salesOrders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(salesOrders.id, id));

      await emitEvent(tx, {
        workspaceId: so.workspaceId,
        eventType: "salesorder.cancelled",
        aggregateType: "sales_order",
        aggregateId: so.id,
        actorUserId: session.user.id,
        payload: { docNumber: so.docNumber, customerId: so.customerId, boardId: so.boardId, itemId: so.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "cancelled" });
  }, { route: "POST /api/sales-orders/[id]/cancel" });
}
