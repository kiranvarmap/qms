import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createCycleCountSchema } from "@/lib/validations";
import { listCycleCounts, createCycleCount } from "@/lib/services/inventory-extended";

// GET /api/inventory/cycle-counts?workspaceId=...
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    return ok({ data: await listCycleCounts(workspaceId) });
  }, { route: "GET /api/inventory/cycle-counts" });
}

// POST /api/inventory/cycle-counts — open a count (snapshots system on-hand)
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createCycleCountSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    return created(await createCycleCount(input.workspaceId, input.warehouseId, input.note, session.user.id));
  }, { route: "POST /api/inventory/cycle-counts" });
}
