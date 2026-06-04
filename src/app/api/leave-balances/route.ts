import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { leaveBalances, leaveTypes, employees } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";

// GET /api/leave-balances?workspaceId=...&employeeId=&year= — balances with remaining
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();

    const conds = [eq(leaveBalances.workspaceId, workspaceId)];
    const employeeId = url.searchParams.get("employeeId");
    if (employeeId) conds.push(eq(leaveBalances.employeeId, employeeId));
    const year = url.searchParams.get("year");
    if (year) conds.push(eq(leaveBalances.periodYear, Number(year)));

    const rows = await db
      .select({
        id: leaveBalances.id,
        employeeId: leaveBalances.employeeId,
        employeeName: employees.name,
        leaveTypeId: leaveBalances.leaveTypeId,
        leaveTypeName: leaveTypes.name,
        periodYear: leaveBalances.periodYear,
        entitledDays: leaveBalances.entitledDays,
        takenDays: leaveBalances.takenDays,
      })
      .from(leaveBalances)
      .leftJoin(employees, eq(employees.id, leaveBalances.employeeId))
      .leftJoin(leaveTypes, eq(leaveTypes.id, leaveBalances.leaveTypeId))
      .where(and(...conds));

    return ok({ data: rows.map((r) => ({ ...r, remainingDays: r.entitledDays - r.takenDays })) });
  }, { route: "GET /api/leave-balances" });
}
