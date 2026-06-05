import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { recurringOrderSchema } from "@/lib/validations";
import { listRecurringInvoices, createRecurringInvoice } from "@/lib/services/books";

export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    return ok({ data: await listRecurringInvoices(workspaceId) });
  }, { route: "GET /api/recurring-invoices" });
}

export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = recurringOrderSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    return created(await createRecurringInvoice(input.workspaceId, { customerId: input.customerId, name: input.name, cadence: input.cadence, lines: input.lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })) }));
  }, { route: "POST /api/recurring-invoices" });
}
