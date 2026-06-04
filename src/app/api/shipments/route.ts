import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { shipments, shipmentLines, salesOrders, salesOrderLineItems } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createShipmentSchema } from "@/lib/validations";

const SHIPPABLE_SO = new Set(["reserved", "approved", "picking", "packed", "shipped"]);

// GET /api/shipments?workspaceId=...&salesOrderId= — list shipments
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const salesOrderId = url.searchParams.get("salesOrderId");
    const conds = [eq(shipments.workspaceId, workspaceId)];
    if (salesOrderId) conds.push(eq(shipments.salesOrderId, salesOrderId));

    const rows = await db
      .select({
        id: shipments.id,
        status: shipments.status,
        carrier: shipments.carrier,
        tracking: shipments.tracking,
        salesOrderId: shipments.salesOrderId,
        soDocNumber: salesOrders.docNumber,
        shippedAt: shipments.shippedAt,
        createdAt: shipments.createdAt,
      })
      .from(shipments)
      .leftJoin(salesOrders, eq(salesOrders.id, shipments.salesOrderId))
      .where(and(...conds))
      .orderBy(desc(shipments.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/shipments" });
}

// POST /api/shipments — create a shipment (pending) for a reserved sales order.
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createShipmentSchema.parse(await req.json());
    const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, input.salesOrderId)).limit(1);
    if (!so) return badRequest("Invalid sales order");
    if (!(await hasModuleAccess(so.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (!SHIPPABLE_SO.has(so.status)) return badRequest(`Cannot ship a ${so.status} sales order`);

    const soLines = await db.select().from(salesOrderLineItems).where(eq(salesOrderLineItems.salesOrderId, so.id));
    const byId = new Map(soLines.map((l) => [l.id, l]));

    for (const l of input.lines) {
      const soLine = byId.get(l.salesOrderLineId);
      if (!soLine) return badRequest("Line is not on this sales order");
      const remaining = soLine.quantity - soLine.qtyShipped;
      if (l.quantity > remaining + 1e-9) return badRequest(`Ship quantity exceeds remaining for "${soLine.description}"`);
    }

    const shipment = await db.transaction(async (tx) => {
      const [s] = await tx
        .insert(shipments)
        .values({
          workspaceId: so.workspaceId,
          salesOrderId: so.id,
          status: "pending",
          carrier: input.carrier || null,
          tracking: input.tracking || null,
          notes: input.notes || null,
        })
        .returning();
      await tx.insert(shipmentLines).values(
        input.lines.map((l) => {
          const soLine = byId.get(l.salesOrderLineId)!;
          return {
            shipmentId: s.id,
            salesOrderLineId: l.salesOrderLineId,
            productId: soLine.productId,
            warehouseId: l.warehouseId ?? so.warehouseId ?? null,
            quantity: l.quantity,
          };
        })
      );
      return s;
    });

    return created(shipment);
  }, { route: "POST /api/shipments" });
}
