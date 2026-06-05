import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createLocationSchema } from "@/lib/validations";
import { listLocations, createLocation } from "@/lib/services/inventory-extended";

// GET /api/inventory/locations?workspaceId=...&warehouseId=...
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    return ok({ data: await listLocations(workspaceId, url.searchParams.get("warehouseId") || undefined) });
  }, { route: "GET /api/inventory/locations" });
}

// POST /api/inventory/locations
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createLocationSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    return created(await createLocation(input.workspaceId, input));
  }, { route: "POST /api/inventory/locations" });
}
