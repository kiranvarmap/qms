import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { importCardTxnsSchema } from "@/lib/validations";
import { listCardTransactions, importCardTransactions } from "@/lib/services/expense-extended";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessExpenses", session.user.role))) return forbidden();
    return ok({ data: await listCardTransactions(workspaceId) });
  }, { route: "GET /api/card-transactions" });
}

// POST /api/card-transactions — import a batch of corporate-card transactions
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = importCardTxnsSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessExpenses", session.user.role))) return forbidden();
    return created({ imported: (await importCardTransactions(input.workspaceId, input.transactions)).length });
  }, { route: "POST /api/card-transactions" });
}
