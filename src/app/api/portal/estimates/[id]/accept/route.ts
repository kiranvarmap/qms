import { db } from "@/lib/db";
import { estimates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, conflict } from "@/lib/api";
import { getPortalSession } from "@/lib/services/portal-auth";
import { loadScopedEstimate } from "@/lib/services/portal-data";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/portal/estimates/[id]/accept — customer accepts (Plan §6.5).
// Stamps acceptedByPortalContactId and emits estimate.accepted → staff notify.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const s = await getPortalSession();
    if (!s) return unauthorized();
    const { id } = await params;

    const est = await loadScopedEstimate(id, s);
    if (!est) return notFound();
    if (!["sent", "viewed"].includes(est.status)) return conflict("This estimate can no longer be accepted");

    await db.transaction(async (tx) => {
      await tx
        .update(estimates)
        .set({ status: "accepted", acceptedAt: new Date(), acceptedByPortalContactId: s.contactId, updatedAt: new Date() })
        .where(eq(estimates.id, id));
      await emitEvent(tx, {
        workspaceId: est.workspaceId,
        eventType: "estimate.accepted",
        aggregateType: "estimate",
        aggregateId: est.id,
        actorUserId: null, // portal-triggered → routes to staff, not portal
        payload: { docNumber: est.docNumber, customerId: est.customerId, viaPortal: true, boardId: est.boardId, itemId: est.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "accepted" });
  }, { route: "POST /api/portal/estimates/[id]/accept" });
}
