import { auth } from "@/lib/auth";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { employeeShiftsSchema } from "@/lib/validations";
import { setEmployeeShifts } from "@/lib/services/production-planning";
import { db } from "@/lib/db";
import { employeeShifts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const data = await db.select().from(employeeShifts).where(eq(employeeShifts.employeeId, id)).orderBy(asc(employeeShifts.dayOfWeek));
    return ok({ data });
  }, { route: "GET /api/employees/[id]/shifts" });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const { shifts } = employeeShiftsSchema.parse(await req.json());
    return ok({ data: await setEmployeeShifts(id, shifts) });
  }, { route: "PUT /api/employees/[id]/shifts" });
}
