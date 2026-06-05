import { auth } from "@/lib/auth";
import { apiHandler, ok, unauthorized, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { stockStatusMoveSchema } from "@/lib/validations";
import { moveStockStatus } from "@/lib/services/inventory-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/inventory/stock-status — move stock between buckets (damage / quarantine / release / scrap)
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = stockStatusMoveSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const res = await moveStockStatus(input.workspaceId, input.move, input, session.user.id);
    dispatchInline();
    return ok(res);
  }, { route: "POST /api/inventory/stock-status" });
}
