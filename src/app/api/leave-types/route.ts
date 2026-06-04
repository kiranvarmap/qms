import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { leaveTypes } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createLeaveTypeSchema } from "@/lib/validations";

// GET /api/leave-types?workspaceId=... — list leave types
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();

    const rows = await db
      .select()
      .from(leaveTypes)
      .where(and(eq(leaveTypes.workspaceId, workspaceId), eq(leaveTypes.isActive, true)))
      .orderBy(asc(leaveTypes.name));
    return ok({ data: rows });
  }, { route: "GET /api/leave-types" });
}

// POST /api/leave-types — create a leave type
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createLeaveTypeSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();

    try {
      const [row] = await db
        .insert(leaveTypes)
        .values({ workspaceId: input.workspaceId, name: input.name, defaultDays: input.defaultDays, isPaid: input.isPaid })
        .returning();
      return created(row);
    } catch {
      return conflict("A leave type with this name already exists");
    }
  }, { route: "POST /api/leave-types" });
}
