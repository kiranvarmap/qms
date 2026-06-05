import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createEcrSchema } from "@/lib/validations";
import { listEcr, createEcr } from "@/lib/services/product";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/ecr?workspaceId=... — list engineering change requests
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    return ok({ data: await listEcr(workspaceId) });
  }, { route: "GET /api/ecr" });
}

// POST /api/ecr — create (optionally submit) an engineering change request
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createEcrSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const ecr = await createEcr(input.workspaceId, input, session.user.id);
    dispatchInline();
    return created(ecr);
  }, { route: "POST /api/ecr" });
}
