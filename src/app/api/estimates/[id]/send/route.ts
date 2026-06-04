import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/estimates/[id]/send — mark a draft estimate as sent to the customer.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [est] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
    if (!est) return notFound();
    if (!(await hasModuleAccess(est.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (est.status !== "draft") return conflict("Only draft estimates can be sent");

    await db.transaction(async (tx) => {
      await tx
        .update(estimates)
        .set({ status: "sent", sentAt: new Date(), customerVisible: true, updatedAt: new Date() })
        .where(eq(estimates.id, id));
      await emitEvent(tx, {
        workspaceId: est.workspaceId,
        eventType: "estimate.sent",
        aggregateType: "estimate",
        aggregateId: est.id,
        actorUserId: session.user.id,
        payload: { docNumber: est.docNumber, customerId: est.customerId, boardId: est.boardId, itemId: est.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "sent" });
  }, { route: "POST /api/estimates/[id]/send" });
}
