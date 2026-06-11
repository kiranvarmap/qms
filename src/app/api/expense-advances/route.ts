import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createAdvanceSchema } from "@/lib/validations";
import { listAdvances, createAdvance } from "@/lib/services/expense-extended";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessExpenses", session.user.role))) return forbidden();
    return ok({ data: await listAdvances(workspaceId) });
  }, { route: "GET /api/expense-advances" });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createAdvanceSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessExpenses", session.user.role))) return forbidden();
    return created(await createAdvance(input.workspaceId, input, session.user.id));
  }, { route: "POST /api/expense-advances" });
}
