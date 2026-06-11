import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders, poLineItems, goodsReceipts, vendors } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updatePurchaseOrderSchema } from "@/lib/validations";
import { writePoLinesAndTotals } from "@/lib/services/purchasing";

async function load(id: string) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  return po ?? null;
}

// GET /api/purchase-orders/[id] — PO with lines, vendor, and receipts
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const po = await load(id);
    if (!po) return notFound();
    if (!(await hasModuleAccess(po.workspaceId, session.user.id, "canAccessPurchasing", session.user.role)))
      return forbidden();

    const [lines, receipts, [vendor]] = await Promise.all([
      db.select().from(poLineItems).where(eq(poLineItems.purchaseOrderId, id)).orderBy(asc(poLineItems.position)),
      db.select().from(goodsReceipts).where(eq(goodsReceipts.purchaseOrderId, id)).orderBy(desc(goodsReceipts.receivedAt)),
      db.select().from(vendors).where(eq(vendors.id, po.vendorId)).limit(1),
    ]);

    return ok({ ...po, vendor: vendor ?? null, lines, receipts });
  }, { route: "GET /api/purchase-orders/[id]" });
}

// PATCH /api/purchase-orders/[id] — edit a draft PO only
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const po = await load(id);
    if (!po) return notFound();
    if (!(await hasModuleAccess(po.workspaceId, session.user.id, "canAccessPurchasing", session.user.role)))
      return forbidden();
    if (po.status !== "draft") return conflict("Only draft purchase orders can be edited");

    const patch = updatePurchaseOrderSchema.parse(await req.json());

    if (patch.vendorId && patch.vendorId !== po.vendorId) {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.id, patch.vendorId)).limit(1);
      if (!vendor || vendor.workspaceId !== po.workspaceId) return badRequest("Invalid vendor");
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(purchaseOrders)
        .set({
          ...(patch.vendorId !== undefined ? { vendorId: patch.vendorId } : {}),
          ...(patch.expectedDate !== undefined
            ? { expectedDate: patch.expectedDate ? new Date(patch.expectedDate) : null }
            : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(purchaseOrders.id, id))
        .returning();
      if (patch.lines) await writePoLinesAndTotals(tx, po.workspaceId, id, patch.lines);
      return row;
    });

    return ok(updated);
  }, { route: "PATCH /api/purchase-orders/[id]" });
}

// DELETE /api/purchase-orders/[id] — only drafts / cancelled POs
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const po = await load(id);
    if (!po) return notFound();
    if (!(await hasModuleAccess(po.workspaceId, session.user.id, "canAccessPurchasing", session.user.role)))
      return forbidden();
    if (po.status !== "draft" && po.status !== "cancelled")
      return conflict("Only draft or cancelled purchase orders can be deleted");

    await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));
    return noContent();
  }, { route: "DELETE /api/purchase-orders/[id]" });
}
