/**
 * Approval SLA + escalation (blueprint 05 §2). The cron sweep finds the
 * CURRENT pending step of every pending approval request whose SLA has
 * lapsed (explicit dueAt, else createdAt + DEFAULT_SLA_HOURS), then — once
 * per step (escalatedAt guard):
 *   1. nudges the assigned approver,
 *   2. escalates to the approver's manager (if any),
 *   3. tells the requester their request is stuck,
 *   4. emits `approval.overdue` for the feed/automation layer.
 */
import { db } from "@/lib/db";
import { approvalRequests, approvalSteps, employees, notifications } from "@/lib/db/schema";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { emitEventStandalone } from "@/lib/events/outbox";

export const DEFAULT_SLA_HOURS = 48;

export async function sweepApprovalSlas(now = new Date()): Promise<{ escalated: number }> {
  const fallbackCutoff = new Date(now.getTime() - DEFAULT_SLA_HOURS * 3_600_000);

  const overdue = await db
    .select({
      step: approvalSteps,
      requestId: approvalRequests.id,
      workspaceId: approvalRequests.workspaceId,
      subjectType: approvalRequests.subjectType,
      subjectId: approvalRequests.subjectId,
      requestedBy: approvalRequests.requestedBy,
    })
    .from(approvalSteps)
    .innerJoin(approvalRequests, eq(approvalRequests.id, approvalSteps.requestId))
    .where(
      and(
        eq(approvalRequests.status, "pending"),
        sql`${approvalSteps.stepNumber} = ${approvalRequests.currentStep}`,
        eq(approvalSteps.decision, "pending"),
        isNull(approvalSteps.escalatedAt),
        or(lte(approvalSteps.dueAt, now), and(isNull(approvalSteps.dueAt), lte(approvalSteps.createdAt, fallbackCutoff)))
      )
    );

  let escalated = 0;
  for (const row of overdue) {
    // Claim the step so a concurrent sweep doesn't double-notify.
    const claimed = await db
      .update(approvalSteps)
      .set({ escalatedAt: now })
      .where(and(eq(approvalSteps.id, row.step.id), isNull(approvalSteps.escalatedAt)))
      .returning({ id: approvalSteps.id });
    if (claimed.length === 0) continue;

    const subject = row.subjectType.replace(/_/g, " ");

    // Approver + their manager (escalation target).
    let approverUserId: string | null = null;
    let managerUserId: string | null = null;
    if (row.step.approverEmployeeId) {
      const [emp] = await db
        .select({ userId: employees.userId, managerEmployeeId: employees.managerEmployeeId })
        .from(employees)
        .where(eq(employees.id, row.step.approverEmployeeId))
        .limit(1);
      approverUserId = emp?.userId ?? null;
      if (emp?.managerEmployeeId) {
        const [mgr] = await db
          .select({ userId: employees.userId })
          .from(employees)
          .where(eq(employees.id, emp.managerEmployeeId))
          .limit(1);
        managerUserId = mgr?.userId ?? null;
      }
    }

    const meta = { requestId: row.requestId, subjectType: row.subjectType, subjectId: row.subjectId };
    if (approverUserId) {
      await db.insert(notifications).values({
        userId: approverUserId,
        type: "approval_overdue",
        title: "Approval overdue",
        body: `A ${subject} approval assigned to you has passed its SLA.`,
        meta,
      });
    }
    if (managerUserId && managerUserId !== approverUserId) {
      await db.insert(notifications).values({
        userId: managerUserId,
        type: "approval_escalated",
        title: "Approval escalated to you",
        body: `A ${subject} approval assigned to your report is overdue.`,
        meta,
      });
    }
    if (row.requestedBy) {
      await db.insert(notifications).values({
        userId: row.requestedBy,
        type: "approval_overdue",
        title: "Your request is stuck",
        body: `Your ${subject} approval is overdue and has been escalated.`,
        meta,
      });
    }

    await emitEventStandalone({
      workspaceId: row.workspaceId,
      eventType: "approval.overdue",
      aggregateType: "approval_request",
      aggregateId: row.requestId,
      actorUserId: null,
      payload: meta,
    });
    escalated++;
  }
  return { escalated };
}
