import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateEmployeeHrSchema } from "@/lib/validations";

// PATCH /api/hr/employees/[id] — update HR fields (manager, department, type).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [emp] = await db.select().from(employees).where(eq(employees.id, id)).limit(1);
    if (!emp) return notFound();
    if (!emp.workspaceId) return badRequest("Employee has no workspace");
    if (!(await hasModuleAccess(emp.workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();

    const patch = updateEmployeeHrSchema.parse(await req.json());
    if (patch.managerEmployeeId && patch.managerEmployeeId === id)
      return badRequest("An employee cannot be their own manager");

    const [updated] = await db
      .update(employees)
      .set({
        ...(patch.managerEmployeeId !== undefined ? { managerEmployeeId: patch.managerEmployeeId } : {}),
        ...(patch.departmentId !== undefined ? { departmentId: patch.departmentId } : {}),
        ...(patch.employmentType !== undefined ? { employmentType: patch.employmentType } : {}),
        ...(patch.designation !== undefined ? { designation: patch.designation } : {}),
        updatedAt: new Date(),
      })
      .where(eq(employees.id, id))
      .returning();
    return ok(updated);
  }, { route: "PATCH /api/hr/employees/[id]" });
}
