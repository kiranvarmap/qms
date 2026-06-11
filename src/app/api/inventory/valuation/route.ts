import { auth } from "@/lib/auth";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { valuationReport } from "@/lib/services/inventory-extended";

// GET /api/inventory/valuation?workspaceId=... — inventory value per product
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    return ok({ data: await valuationReport(workspaceId) });
  }, { route: "GET /api/inventory/valuation" });
}
