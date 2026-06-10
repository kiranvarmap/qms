import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createApprovalRequest } from "@/lib/services/approvals";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/sales-orders/[id]/submit — route a draft order through the
// generic approval engine (audit 02 §3: pending_approval was unreachable).
// On approval, runApprovalSubjectSync reserves stock and approves the order;
// on rejection it returns to draft for rework.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
    if (!so) return notFound();
    if (!(await hasModuleAccess(so.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (so.status !== "draft") return conflict("Only draft sales orders can be submitted");

    await db.transaction(async (tx) => {
      await tx
        .update(salesOrders)
        .set({ status: "pending_approval", updatedAt: new Date() })
        .where(eq(salesOrders.id, id));
      await createApprovalRequest(tx, {
        workspaceId: so.workspaceId,
        subjectType: "sales_order",
        subjectId: so.id,
        requestedBy: session.user.id,
        amountMinor: so.totalMinor,
        boardId: so.boardId,
        itemId: so.itemId,
      });
      await emitEvent(tx, {
        workspaceId: so.workspaceId,
        eventType: "salesorder.submitted",
        aggregateType: "sales_order",
        aggregateId: so.id,
        actorUserId: session.user.id,
        payload: { docNumber: so.docNumber, customerId: so.customerId, boardId: so.boardId, itemId: so.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "pending_approval" });
  }, { route: "POST /api/sales-orders/[id]/submit" });
}
