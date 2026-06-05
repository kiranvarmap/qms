import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateCustomerSchema } from "@/lib/validations";
import { getCustomerDetail, updateCustomer } from "@/lib/services/customer";

async function load(id: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return customer ?? null;
}

// GET /api/customers/[id] — full record incl. contact persons
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const customer = await load(id);
    if (!customer) return notFound();
    if (!(await hasModuleAccess(customer.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    return ok(await getCustomerDetail(customer.workspaceId, id));
  }, { route: "GET /api/customers/[id]" });
}

// PATCH /api/customers/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const customer = await load(id);
    if (!customer) return notFound();
    if (!(await hasModuleAccess(customer.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const patch = updateCustomerSchema.parse(await req.json());
    const updated = await updateCustomer(customer.workspaceId, id, patch);
    return ok(updated);
  }, { route: "PATCH /api/customers/[id]" });
}

// DELETE /api/customers/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const customer = await load(id);
    if (!customer) return notFound();
    if (!(await hasModuleAccess(customer.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    await db.delete(customers).where(eq(customers.id, id));
    return noContent();
  }, { route: "DELETE /api/customers/[id]" });
}
