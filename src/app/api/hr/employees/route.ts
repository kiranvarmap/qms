import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { employees, departments } from "@/lib/db/schema";
import { alias } from "drizzle-orm/pg-core";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";

// GET /api/hr/employees?workspaceId=... — HR directory (department + manager).
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();

    const manager = alias(employees, "manager");
    const rows = await db
      .select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
        employeeId: employees.employeeId,
        designation: employees.designation,
        employmentType: employees.employmentType,
        status: employees.status,
        departmentId: employees.departmentId,
        departmentName: departments.name,
        managerEmployeeId: employees.managerEmployeeId,
        managerName: manager.name,
      })
      .from(employees)
      .leftJoin(departments, eq(departments.id, employees.departmentId))
      .leftJoin(manager, eq(manager.id, employees.managerEmployeeId))
      .where(eq(employees.workspaceId, workspaceId))
      .orderBy(asc(employees.name));
    return ok({ data: rows });
  }, { route: "GET /api/hr/employees" });
}
