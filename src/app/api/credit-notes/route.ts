import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createCreditNoteSchema } from "@/lib/validations";
import { listCreditNotes, createCreditNote } from "@/lib/services/books";
import { dispatchInline } from "@/lib/events/dispatcher";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    return ok({ data: await listCreditNotes(workspaceId) });
  }, { route: "GET /api/credit-notes" });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createCreditNoteSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const cn = await createCreditNote(input.workspaceId, input, session.user.id);
    dispatchInline();
    return created(cn);
  }, { route: "POST /api/credit-notes" });
}
