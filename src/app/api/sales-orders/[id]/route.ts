import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesOrders, salesOrderLineItems, shipments, customers } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateSalesOrderSchema } from "@/lib/validations";
import { writeSalesOrderLinesAndTotals } from "@/lib/services/sales-orders";

async function load(id: string) {
  const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
  return so ?? null;
}

// GET /api/sales-orders/[id] — order with lines, customer, shipments
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const so = await load(id);
    if (!so) return notFound();
    if (!(await hasModuleAccess(so.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const [lines, shipmentRows, [customer]] = await Promise.all([
      db.select().from(salesOrderLineItems).where(eq(salesOrderLineItems.salesOrderId, id)).orderBy(asc(salesOrderLineItems.position)),
      db.select().from(shipments).where(eq(shipments.salesOrderId, id)).orderBy(desc(shipments.createdAt)),
      db.select().from(customers).where(eq(customers.id, so.customerId)).limit(1),
    ]);

    return ok({ ...so, customer: customer ?? null, lines, shipments: shipmentRows });
  }, { route: "GET /api/sales-orders/[id]" });
}

// PATCH /api/sales-orders/[id] — edit a draft order only
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const so = await load(id);
    if (!so) return notFound();
    if (!(await hasModuleAccess(so.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (so.status !== "draft") return conflict("Only draft sales orders can be edited");

    const patch = updateSalesOrderSchema.parse(await req.json());
    if (patch.customerId && patch.customerId !== so.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, patch.customerId)).limit(1);
      if (!c || c.workspaceId !== so.workspaceId) return badRequest("Invalid customer");
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(salesOrders)
        .set({
          ...(patch.customerId !== undefined ? { customerId: patch.customerId } : {}),
          ...(patch.warehouseId !== undefined ? { warehouseId: patch.warehouseId } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(salesOrders.id, id))
        .returning();
      if (patch.lines) await writeSalesOrderLinesAndTotals(tx, so.workspaceId, id, patch.lines);
      return row;
    });

    return ok(updated);
  }, { route: "PATCH /api/sales-orders/[id]" });
}

// DELETE /api/sales-orders/[id] — draft / cancelled only
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const so = await load(id);
    if (!so) return notFound();
    if (!(await hasModuleAccess(so.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (so.status !== "draft" && so.status !== "cancelled")
      return conflict("Only draft or cancelled sales orders can be deleted");

    await db.delete(salesOrders).where(eq(salesOrders.id, id));
    return noContent();
  }, { route: "DELETE /api/sales-orders/[id]" });
}
