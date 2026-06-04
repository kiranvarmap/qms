import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateCustomerSchema } from "@/lib/validations";

async function load(id: string) {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return customer ?? null;
}

// GET /api/customers/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const customer = await load(id);
    if (!customer) return notFound();
    if (!(await hasModuleAccess(customer.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    return ok(customer);
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
    const [updated] = await db
      .update(customers)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.code !== undefined ? { code: patch.code || null } : {}),
        ...(patch.email !== undefined ? { email: patch.email || null } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
        ...(patch.taxId !== undefined ? { taxId: patch.taxId || null } : {}),
        ...(patch.billingAddress !== undefined ? { billingAddress: patch.billingAddress } : {}),
        ...(patch.shippingAddress !== undefined ? { shippingAddress: patch.shippingAddress } : {}),
        ...(patch.paymentTermsDays !== undefined ? { paymentTermsDays: patch.paymentTermsDays } : {}),
        ...(patch.accountManagerEmployeeId !== undefined
          ? { accountManagerEmployeeId: patch.accountManagerEmployeeId || null }
          : {}),
        ...(patch.boardId !== undefined ? { boardId: patch.boardId || null } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, id))
      .returning();

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
