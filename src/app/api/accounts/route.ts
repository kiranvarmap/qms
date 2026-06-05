import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createAccountSchema } from "@/lib/validations";
import { listAccounts, createAccount } from "@/lib/services/books";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    return ok({ data: await listAccounts(workspaceId) });
  }, { route: "GET /api/accounts" });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createAccountSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    return created(await createAccount(input.workspaceId, input));
  }, { route: "POST /api/accounts" });
}
