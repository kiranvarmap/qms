import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { departments } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createDepartmentSchema } from "@/lib/validations";

// GET /api/departments?workspaceId=... — list departments
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();

    const rows = await db.select().from(departments).where(eq(departments.workspaceId, workspaceId)).orderBy(asc(departments.name));
    return ok({ data: rows });
  }, { route: "GET /api/departments" });
}

// POST /api/departments — create a department
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createDepartmentSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();

    try {
      const [row] = await db
        .insert(departments)
        .values({ workspaceId: input.workspaceId, name: input.name, headEmployeeId: input.headEmployeeId || null })
        .returning();
      return created(row);
    } catch {
      return conflict("A department with this name already exists");
    }
  }, { route: "POST /api/departments" });
}
