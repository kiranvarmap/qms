import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createApBillSchema } from "@/lib/validations";
import { listInvoicesByKind, createApBill } from "@/lib/services/books";
import { dispatchInline } from "@/lib/events/dispatcher";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    return ok({ data: await listInvoicesByKind(workspaceId, "ap") });
  }, { route: "GET /api/ap-bills" });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createApBillSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const bill = await createApBill(input.workspaceId, input, session.user.id);
    dispatchInline();
    return created(bill);
  }, { route: "POST /api/ap-bills" });
}
