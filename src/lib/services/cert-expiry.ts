/**
 * Certification expiry sweep (Plan §9).
 *
 * Flags valid certification records as `expiring` (within 30 days of expiry,
 * emits certification.expiring) or `expired` (past expiry). Idempotent — only
 * transitions records whose status doesn't already match. Run from the events
 * cron alongside the outbox dispatch and overdue-invoice sweep.
 */

import { db } from "@/lib/db";
import { certificationRecords } from "@/lib/db/schema";
import { and, eq, isNotNull, lt, ne } from "drizzle-orm";
import { emitEventStandalone } from "@/lib/events/outbox";

const EXPIRING_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function sweepCertifications(now = new Date()): Promise<{ expiring: number; expired: number }> {
  const soon = new Date(now.getTime() + EXPIRING_WINDOW_MS);

  // Past expiry → expired.
  const expired = await db
    .update(certificationRecords)
    .set({ status: "expired" })
    .where(and(isNotNull(certificationRecords.expiresAt), lt(certificationRecords.expiresAt, now), ne(certificationRecords.status, "expired")))
    .returning({ id: certificationRecords.id });

  // Within the window (but not yet expired) and still marked valid → expiring.
  const expiringRows = await db
    .select()
    .from(certificationRecords)
    .where(and(isNotNull(certificationRecords.expiresAt), lt(certificationRecords.expiresAt, soon), eq(certificationRecords.status, "valid")));

  for (const rec of expiringRows) {
    if (rec.expiresAt && rec.expiresAt >= now) {
      await db.update(certificationRecords).set({ status: "expiring" }).where(eq(certificationRecords.id, rec.id));
      await emitEventStandalone({
        workspaceId: rec.workspaceId,
        eventType: "certification.expiring",
        aggregateType: "certification_record",
        aggregateId: rec.id,
        payload: { employeeId: rec.employeeId, certificationId: rec.certificationId, expiresAt: rec.expiresAt },
      });
    }
  }

  return { expiring: expiringRows.length, expired: expired.length };
}
