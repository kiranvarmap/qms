import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers, invoices, salesOrders, estimates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateCustomerSchema } from "@/lib/validations";
import { getCustomerDetail, updateCustomer } from "@/lib/services/customer";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

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

    await emitEvent(db, {
      workspaceId: customer.workspaceId,
      eventType: "customer.updated",
      aggregateType: "customer",
      aggregateId: id,
      actorUserId: session.user.id,
      payload: { name: customer.name },
    });
    dispatchInline();

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

    // Referential guard (audit P2): customers with documents are archived,
    // not deleted — their history must survive.
    const refs: string[] = [];
    const [inv] = await db.select({ id: invoices.id }).from(invoices).where(eq(invoices.customerId, id)).limit(1);
    if (inv) refs.push("invoices");
    const [so] = await db.select({ id: salesOrders.id }).from(salesOrders).where(eq(salesOrders.customerId, id)).limit(1);
    if (so) refs.push("sales orders");
    const [est] = await db.select({ id: estimates.id }).from(estimates).where(eq(estimates.customerId, id)).limit(1);
    if (est) refs.push("estimates");
    if (refs.length > 0)
      return conflict(`Cannot delete: customer has ${refs.join(", ")}. Set the customer inactive instead.`);

    await db.delete(customers).where(eq(customers.id, id));
    return noContent();
  }, { route: "DELETE /api/customers/[id]" });
}
