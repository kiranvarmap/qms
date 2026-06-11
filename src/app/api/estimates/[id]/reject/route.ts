import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/estimates/[id]/reject — mark an estimate rejected.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [est] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
    if (!est) return notFound();
    if (!(await hasModuleAccess(est.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (!["sent", "viewed"].includes(est.status)) return conflict("Only sent estimates can be rejected");

    await db.transaction(async (tx) => {
      await tx
        .update(estimates)
        .set({ status: "rejected", updatedAt: new Date() })
        .where(eq(estimates.id, id));
      await emitEvent(tx, {
        workspaceId: est.workspaceId,
        eventType: "estimate.rejected",
        aggregateType: "estimate",
        aggregateId: est.id,
        actorUserId: session.user.id,
        payload: { docNumber: est.docNumber, customerId: est.customerId, boardId: est.boardId, itemId: est.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "rejected" });
  }, { route: "POST /api/estimates/[id]/reject" });
}
