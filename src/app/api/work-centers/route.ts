import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createWorkCenterSchema } from "@/lib/validations";
import { listWorkCenters, createWorkCenter } from "@/lib/services/production-planning";

// GET /api/work-centers?workspaceId=... — list work centers
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    return ok({ data: await listWorkCenters(workspaceId) });
  }, { route: "GET /api/work-centers" });
}

// POST /api/work-centers — create a work center
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createWorkCenterSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const { workspaceId, ...rest } = input;
    return created(await createWorkCenter(workspaceId, rest));
  }, { route: "POST /api/work-centers" });
}
