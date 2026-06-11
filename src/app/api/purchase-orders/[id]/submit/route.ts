import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createApprovalRequest } from "@/lib/services/approvals";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/purchase-orders/[id]/submit — send a draft PO into approval.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!po) return notFound();
    if (!(await hasModuleAccess(po.workspaceId, session.user.id, "canAccessPurchasing", session.user.role)))
      return forbidden();
    if (po.status !== "draft") return conflict("Only draft purchase orders can be submitted");

    await db.transaction(async (tx) => {
      await tx
        .update(purchaseOrders)
        .set({ status: "pending_approval", updatedAt: new Date() })
        .where(eq(purchaseOrders.id, id));

      await createApprovalRequest(tx, {
        workspaceId: po.workspaceId,
        subjectType: "purchase_order",
        subjectId: po.id,
        requestedBy: session.user.id,
        amountMinor: po.totalMinor,
        boardId: po.boardId,
        itemId: po.itemId,
      });

      await emitEvent(tx, {
        workspaceId: po.workspaceId,
        eventType: "po.submitted",
        aggregateType: "purchase_order",
        aggregateId: po.id,
        actorUserId: session.user.id,
        payload: { docNumber: po.docNumber, vendorId: po.vendorId, boardId: po.boardId, itemId: po.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "pending_approval" });
  }, { route: "POST /api/purchase-orders/[id]/submit" });
}
