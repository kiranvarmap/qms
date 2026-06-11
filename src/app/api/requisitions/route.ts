import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createRequisitionSchema } from "@/lib/validations";
import { listRequisitions, createRequisition } from "@/lib/services/purchasing-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessPurchasing", session.user.role))) return forbidden();
    return ok({ data: await listRequisitions(workspaceId) });
  }, { route: "GET /api/requisitions" });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createRequisitionSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessPurchasing", session.user.role))) return forbidden();
    const r = await createRequisition(input.workspaceId, input, session.user.id);
    dispatchInline();
    return created(r);
  }, { route: "POST /api/requisitions" });
}
