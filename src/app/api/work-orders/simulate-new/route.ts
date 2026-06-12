import { auth } from "@/lib/auth";
import { apiHandler, ok, unauthorized, forbidden, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { simulateNewOrderSchema } from "@/lib/validations";
import { runPlanningForDraft } from "@/lib/services/planning-engine";

// POST /api/work-orders/simulate-new — plan a HYPOTHETICAL work order against
// the current production load without creating anything. No DB writes.
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = simulateNewOrderSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const result = await runPlanningForDraft(input.workspaceId, input, {
      requestedStartDate: input.requestedStartDate,
    });
    if (!result) return badRequest("Could not plan this order");
    return ok({ data: result });
  }, { route: "POST /api/work-orders/simulate-new" });
}
