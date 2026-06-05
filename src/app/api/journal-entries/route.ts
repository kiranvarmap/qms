import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createJournalSchema } from "@/lib/validations";
import { listJournals, createJournal } from "@/lib/services/books";
import { dispatchInline } from "@/lib/events/dispatcher";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    return ok({ data: await listJournals(workspaceId) });
  }, { route: "GET /api/journal-entries" });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createJournalSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const res = await createJournal(input.workspaceId, input, session.user.id);
    if ("error" in res) return badRequest(`Journal must balance: debits ${(res.totalDebit / 100).toFixed(2)} ≠ credits ${(res.totalCredit / 100).toFixed(2)}`);
    dispatchInline();
    return created(res);
  }, { route: "POST /api/journal-entries" });
}
