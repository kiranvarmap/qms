import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createMaintenanceOrderSchema } from "@/lib/validations";
import { listMaintenanceOrders, createMaintenanceOrder } from "@/lib/services/maintenance";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/maintenance-orders?workspaceId=...
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    return ok({ data: await listMaintenanceOrders(workspaceId) });
  }, { route: "GET /api/maintenance-orders" });
}

// POST /api/maintenance-orders — raise a corrective/preventive order
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createMaintenanceOrderSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    const mo = await createMaintenanceOrder(input.workspaceId, input, session.user.id);
    dispatchInline();
    return created(mo);
  }, { route: "POST /api/maintenance-orders" });
}
