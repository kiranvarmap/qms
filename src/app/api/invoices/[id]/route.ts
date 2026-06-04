import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices, invoiceLineItems, payments, customers } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateInvoiceSchema } from "@/lib/validations";
import { writeInvoiceLinesAndTotals } from "@/lib/services/invoices";

async function load(id: string) {
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  return inv ?? null;
}

// GET /api/invoices/[id] — invoice with lines, customer, payments
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const inv = await load(id);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const [lines, paymentRows, [customer]] = await Promise.all([
      db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)).orderBy(asc(invoiceLineItems.position)),
      db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.receivedDate)),
      db.select().from(customers).where(eq(customers.id, inv.customerId)).limit(1),
    ]);

    return ok({ ...inv, customer: customer ?? null, lines, payments: paymentRows });
  }, { route: "GET /api/invoices/[id]" });
}

// PATCH /api/invoices/[id] — edit a draft invoice only
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const inv = await load(id);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (inv.status !== "draft") return conflict("Only draft invoices can be edited");

    const patch = updateInvoiceSchema.parse(await req.json());
    if (patch.customerId && patch.customerId !== inv.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, patch.customerId)).limit(1);
      if (!c || c.workspaceId !== inv.workspaceId) return badRequest("Invalid customer");
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(invoices)
        .set({
          ...(patch.customerId !== undefined ? { customerId: patch.customerId } : {}),
          ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate ? new Date(patch.dueDate) : null } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, id))
        .returning();
      if (patch.lines) await writeInvoiceLinesAndTotals(tx, inv.workspaceId, id, patch.lines);
      return row;
    });

    return ok(updated);
  }, { route: "PATCH /api/invoices/[id]" });
}

// DELETE /api/invoices/[id] — draft / void only
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const inv = await load(id);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (inv.status !== "draft" && inv.status !== "void")
      return conflict("Only draft or void invoices can be deleted");

    await db.delete(invoices).where(eq(invoices.id, id));
    return noContent();
  }, { route: "DELETE /api/invoices/[id]" });
}
