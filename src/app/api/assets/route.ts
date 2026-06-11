import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createAssetSchema } from "@/lib/validations";
import { listAssets, createAsset } from "@/lib/services/maintenance";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/assets?workspaceId=... — list the asset register
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    return ok({ data: await listAssets(workspaceId) });
  }, { route: "GET /api/assets" });
}

// POST /api/assets — register an asset
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createAssetSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    const asset = await createAsset(input.workspaceId, input, session.user.id);
    dispatchInline();
    return created(asset);
  }, { route: "POST /api/assets" });
}
