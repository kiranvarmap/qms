import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createPurchaseReturnSchema } from "@/lib/validations";
import { listReturns, createReturn } from "@/lib/services/purchasing-extended";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessPurchasing", session.user.role))) return forbidden();
    return ok({ data: await listReturns(workspaceId) });
  }, { route: "GET /api/purchase-returns" });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createPurchaseReturnSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessPurchasing", session.user.role))) return forbidden();
    return created(await createReturn(input.workspaceId, input, session.user.id));
  }, { route: "POST /api/purchase-returns" });
}
