/**
 * Estimate expiry sweep (audit 02 §2 — `expired` was an unreachable status).
 * Open estimates past their validity date flip to `expired` and announce it,
 * so pipeline reports stop counting dead quotes and owners get nudged.
 * Idempotent: the status guard means a re-sweep matches nothing.
 */
import { db } from "@/lib/db";
import { estimates } from "@/lib/db/schema";
import { and, inArray, isNotNull, lte } from "drizzle-orm";
import { emitEventStandalone } from "@/lib/events/outbox";

export async function sweepExpiredEstimates(now = new Date()): Promise<{ expired: number }> {
  const rows = await db
    .update(estimates)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        inArray(estimates.status, ["sent", "viewed"]),
        isNotNull(estimates.validUntil),
        lte(estimates.validUntil, now)
      )
    )
    .returning({
      id: estimates.id,
      workspaceId: estimates.workspaceId,
      docNumber: estimates.docNumber,
      customerId: estimates.customerId,
    });

  for (const est of rows) {
    await emitEventStandalone({
      workspaceId: est.workspaceId,
      eventType: "estimate.expired",
      aggregateType: "estimate",
      aggregateId: est.id,
      actorUserId: null,
      payload: { docNumber: est.docNumber, customerId: est.customerId },
    });
  }
  return { expired: rows.length };
}
