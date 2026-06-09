import { auth } from "@/lib/auth";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { employeeSkillsSchema } from "@/lib/validations";
import { listEmployeeSkills, setEmployeeSkills } from "@/lib/services/production-planning";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    return ok({ data: await listEmployeeSkills(workspaceId, id) });
  }, { route: "GET /api/employees/[id]/skills" });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const input = employeeSkillsSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    return ok({ data: await setEmployeeSkills(input.workspaceId, id, input.skills) });
  }, { route: "PUT /api/employees/[id]/skills" });
}
