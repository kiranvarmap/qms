/**
 * Preventive-maintenance generation (blueprint 04 §5 — "PM schedule generates
 * orders"). Swept by the events cron: every active time-based schedule whose
 * `nextDue` has passed spawns one maintenance order and rolls `nextDue`
 * forward by `intervalDays` in the same transaction — so a retried sweep can
 * never double-generate. One-shot schedules (intervalDays 0) deactivate after
 * generating.
 */
import { db } from "@/lib/db";
import { pmSchedules } from "@/lib/db/schema";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { createMaintenanceOrder } from "@/lib/services/maintenance";

const SYSTEM_NOTE = "Auto-generated from PM schedule";

export async function sweepPmSchedules(now = new Date()): Promise<{ generated: number }> {
  const due = await db
    .select()
    .from(pmSchedules)
    .where(and(eq(pmSchedules.isActive, true), isNotNull(pmSchedules.nextDue), lte(pmSchedules.nextDue, now)));

  let generated = 0;
  for (const sched of due) {
    // Claim the schedule first (roll nextDue / deactivate); only the claimer
    // generates, so concurrent sweeps can't double-create.
    const claimed = await db
      .update(pmSchedules)
      .set(
        sched.intervalDays > 0
          ? { nextDue: new Date(sched.nextDue!.getTime() + sched.intervalDays * 86_400_000) }
          : { isActive: false }
      )
      .where(and(eq(pmSchedules.id, sched.id), eq(pmSchedules.nextDue, sched.nextDue!)))
      .returning({ id: pmSchedules.id });
    if (claimed.length === 0) continue;

    await createMaintenanceOrder(
      sched.workspaceId,
      {
        assetId: sched.assetId,
        type: "preventive",
        scheduledDate: sched.nextDue!.toISOString(),
        fault: `${SYSTEM_NOTE}: ${sched.name}${sched.checklist ? `\n\nChecklist:\n${sched.checklist}` : ""}`,
      },
      null // system actor — PM generation has no interactive user
    );
    generated++;
  }
  return { generated };
}
