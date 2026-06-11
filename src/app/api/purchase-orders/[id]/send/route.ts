import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/purchase-orders/[id]/send — mark an approved PO as sent to vendor.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!po) return notFound();
    if (!(await hasModuleAccess(po.workspaceId, session.user.id, "canAccessPurchasing", session.user.role)))
      return forbidden();
    if (po.status !== "approved") return conflict("Only approved purchase orders can be sent");

    await db.transaction(async (tx) => {
      await tx
        .update(purchaseOrders)
        .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id));
      await emitEvent(tx, {
        workspaceId: po.workspaceId,
        eventType: "po.sent",
        aggregateType: "purchase_order",
        aggregateId: po.id,
        actorUserId: session.user.id,
        payload: { docNumber: po.docNumber, vendorId: po.vendorId, boardId: po.boardId, itemId: po.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "sent" });
  }, { route: "POST /api/purchase-orders/[id]/send" });
}
