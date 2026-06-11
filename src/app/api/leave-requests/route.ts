import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { leaveRequests, leaveTypes, employees } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createLeaveRequestSchema } from "@/lib/validations";
import { createApprovalRequest } from "@/lib/services/approvals";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/leave-requests?workspaceId=...&status=&mine=true — list requests
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();

    const status = url.searchParams.get("status");
    const conds = [eq(leaveRequests.workspaceId, workspaceId)];
    if (status) conds.push(eq(leaveRequests.status, status as typeof leaveRequests.$inferSelect.status));
    if (url.searchParams.get("mine") === "true") {
      const [me] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.userId, session.user.id), eq(employees.workspaceId, workspaceId)))
        .limit(1);
      if (!me) return ok({ data: [] });
      conds.push(eq(leaveRequests.employeeId, me.id));
    }

    const rows = await db
      .select({
        id: leaveRequests.id,
        status: leaveRequests.status,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        days: leaveRequests.days,
        reason: leaveRequests.reason,
        employeeName: employees.name,
        leaveTypeName: leaveTypes.name,
      })
      .from(leaveRequests)
      .leftJoin(employees, eq(employees.id, leaveRequests.employeeId))
      .leftJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.leaveTypeId))
      .where(and(...conds))
      .orderBy(desc(leaveRequests.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/leave-requests" });
}

// POST /api/leave-requests — create and submit a leave request (→ approval).
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createLeaveRequestSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();

    let employeeId = input.employeeId;
    if (!employeeId) {
      const [me] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.userId, session.user.id), eq(employees.workspaceId, input.workspaceId)))
        .limit(1);
      if (!me) return badRequest("No employee record for the current user; pass employeeId");
      employeeId = me.id;
    }

    const [leaveType] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, input.leaveTypeId)).limit(1);
    if (!leaveType || leaveType.workspaceId !== input.workspaceId) return badRequest("Invalid leave type");

    const request = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(leaveRequests)
        .values({
          workspaceId: input.workspaceId,
          employeeId,
          leaveTypeId: input.leaveTypeId,
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          days: input.days,
          reason: input.reason || null,
          coveringEmployeeId: input.coveringEmployeeId || null,
          status: "pending",
          createdBy: session.user.id,
        })
        .returning();

      await createApprovalRequest(tx, {
        workspaceId: input.workspaceId,
        subjectType: "leave_request",
        subjectId: row.id,
        requestedBy: session.user.id,
      });

      await emitEvent(tx, {
        workspaceId: input.workspaceId,
        eventType: "leave.requested",
        aggregateType: "leave_request",
        aggregateId: row.id,
        actorUserId: session.user.id,
        payload: { employeeId, days: input.days },
      });
      return row;
    });

    dispatchInline();
    return created(request);
  }, { route: "POST /api/leave-requests" });
}
