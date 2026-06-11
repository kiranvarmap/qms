import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createWorkOrderSchema } from "@/lib/validations";
import { listWorkOrders, createWorkOrder } from "@/lib/services/production";

// GET /api/work-orders?workspaceId=... — list work orders
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    return ok({ data: await listWorkOrders(workspaceId) });
  }, { route: "GET /api/work-orders" });
}

// POST /api/work-orders — create a work order (explodes the chosen BOM)
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createWorkOrderSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const wo = await createWorkOrder(input.workspaceId, input, session.user.id);
    // Run a feasibility plan immediately so the job lands with a status, but
    // never let a planning hiccup block the creation itself (BRD 13).
    try {
      const { planAndPersist } = await import("@/lib/services/planning-engine");
      await planAndPersist(input.workspaceId, wo.id, session.user.id);
    } catch { /* planning is best-effort on create */ }

    return created(wo);
  }, { route: "POST /api/work-orders" });
}
