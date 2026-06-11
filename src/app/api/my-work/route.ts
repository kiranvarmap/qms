import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  approvalRequests,
  approvalSteps,
  employees,
  inspections,
  notifications,
  workspaceMembers,
} from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";

// GET /api/my-work?workspaceId=... — the cross-module personal inbox
// (blueprint 07 §4): approvals awaiting MY decision (with SLA state), my
// pending requests, my open inspections, and my unread notifications.
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");

    const [membership] = await db
      .select({ role: workspaceMembers.role })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, session.user.id)))
      .limit(1);
    if (!membership && session.user.role !== "admin") return forbidden();

    const [me] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(and(eq(employees.userId, session.user.id), eq(employees.workspaceId, workspaceId)))
      .limit(1);

    // 1 — approvals awaiting my decision (current step assigned to me).
    const approvalsToDecide = me
      ? await db
          .select({
            id: approvalRequests.id,
            subjectType: approvalRequests.subjectType,
            subjectId: approvalRequests.subjectId,
            requestedBy: approvalRequests.requestedBy,
            createdAt: approvalRequests.createdAt,
            dueAt: approvalSteps.dueAt,
          })
          .from(approvalRequests)
          .innerJoin(
            approvalSteps,
            and(
              eq(approvalSteps.requestId, approvalRequests.id),
              eq(approvalSteps.stepNumber, approvalRequests.currentStep),
              eq(approvalSteps.approverEmployeeId, me.id),
              eq(approvalSteps.decision, "pending")
            )
          )
          .where(and(eq(approvalRequests.workspaceId, workspaceId), eq(approvalRequests.status, "pending")))
          .orderBy(desc(approvalRequests.createdAt))
          .limit(25)
      : [];

    // 2 — my requests still pending someone else.
    const myRequests = await db
      .select({
        id: approvalRequests.id,
        subjectType: approvalRequests.subjectType,
        subjectId: approvalRequests.subjectId,
        currentStep: approvalRequests.currentStep,
        createdAt: approvalRequests.createdAt,
      })
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.workspaceId, workspaceId),
          eq(approvalRequests.requestedBy, session.user.id),
          eq(approvalRequests.status, "pending")
        )
      )
      .orderBy(desc(approvalRequests.createdAt))
      .limit(25);

    // 3 — inspections I'm conducting that aren't finished.
    const openInspections = await db
      .select({
        id: inspections.id,
        title: inspections.title,
        status: inspections.status,
        createdAt: inspections.createdAt,
      })
      .from(inspections)
      .where(
        and(
          eq(inspections.workspaceId, workspaceId),
          eq(inspections.conductedBy, session.user.id),
          eq(inspections.status, "in_progress")
        )
      )
      .orderBy(desc(inspections.createdAt))
      .limit(25);

    // 4 — my latest unread notifications.
    const unread = await db
      .select({
        id: notifications.id,
        type: notifications.type,
        title: notifications.title,
        body: notifications.body,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(and(eq(notifications.userId, session.user.id), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt))
      .limit(15);

    const now = Date.now();
    return ok({
      approvalsToDecide: approvalsToDecide.map((a) => ({
        ...a,
        overdue: a.dueAt ? new Date(a.dueAt).getTime() < now : false,
      })),
      myRequests,
      openInspections,
      unread,
    });
  }, { route: "GET /api/my-work" });
}
