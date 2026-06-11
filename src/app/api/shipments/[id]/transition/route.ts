import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { shipments, shipmentLines, salesOrders, salesOrderLineItems, products } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { applyStockMovement } from "@/lib/services/inventory";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";
import { z } from "zod";

const bodySchema = z.object({ action: z.enum(["pick", "pack", "ship", "deliver"]) });

// Allowed source states for each action.
const ALLOWED: Record<string, string[]> = {
  pick: ["pending"],
  pack: ["pending", "picked"],
  ship: ["pending", "picked", "packed"],
  deliver: ["shipped"],
};
const NEXT: Record<string, "picked" | "packed" | "shipped" | "delivered"> = {
  pick: "picked",
  pack: "packed",
  ship: "shipped",
  deliver: "delivered",
};
const EVENT: Record<string, "shipment.picked" | "shipment.packed" | "shipment.shipped" | "shipment.delivered"> = {
  pick: "shipment.picked",
  pack: "shipment.packed",
  ship: "shipment.shipped",
  deliver: "shipment.delivered",
};

// POST /api/shipments/[id]/transition { action } — pick | pack | ship | deliver.
// `ship` is the SINGLE on-hand deduction for sales (Plan §6.3): each tracked
// line lowers on-hand AND releases the matching committed.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const { action } = bodySchema.parse(await req.json());

    const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id)).limit(1);
    if (!shipment) return notFound();
    if (!(await hasModuleAccess(shipment.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (!ALLOWED[action].includes(shipment.status))
      return conflict(`Cannot ${action} a ${shipment.status} shipment`);

    const lines = await db.select().from(shipmentLines).where(eq(shipmentLines.shipmentId, id));

    await db.transaction(async (tx) => {
      if (action === "ship") {
        // Which products track stock?
        const productIds = lines.map((l) => l.productId).filter(Boolean) as string[];
        const tracked = new Set<string>();
        if (productIds.length > 0) {
          const prods = await tx.select().from(products).where(inArray(products.id, productIds));
          for (const p of prods) if (p.trackInventory) tracked.add(p.id);
        }
        for (const line of lines) {
          if (line.productId && tracked.has(line.productId) && line.warehouseId) {
            await applyStockMovement(tx, {
              workspaceId: shipment.workspaceId,
              productId: line.productId,
              warehouseId: line.warehouseId,
              type: "shipment",
              quantity: line.quantity,
              refType: "shipment",
              refId: shipment.id,
              actorUserId: session.user.id,
            });
          }
          // Advance the SO line's shipped quantity (prevents double-ship).
          const [soLine] = await tx
            .select()
            .from(salesOrderLineItems)
            .where(eq(salesOrderLineItems.id, line.salesOrderLineId))
            .limit(1);
          if (soLine) {
            await tx
              .update(salesOrderLineItems)
              .set({
                qtyShipped: soLine.qtyShipped + line.quantity,
                qtyReserved: Math.max(0, soLine.qtyReserved - line.quantity),
              })
              .where(eq(salesOrderLineItems.id, soLine.id));
          }
        }
      }

      await tx
        .update(shipments)
        .set({
          status: NEXT[action],
          ...(action === "ship" ? { shippedAt: new Date(), shippedBy: session.user.id } : {}),
          ...(action === "deliver" ? { deliveredAt: new Date() } : {}),
        })
        .where(eq(shipments.id, id));

      // Roll the SO status forward.
      const soLines = await tx.select().from(salesOrderLineItems).where(eq(salesOrderLineItems.salesOrderId, shipment.salesOrderId));
      const allShipped = soLines.every((l) => l.qtyShipped >= l.quantity - 1e-9);
      let soStatus: typeof salesOrders.$inferSelect.status | null = null;
      if (action === "pick") soStatus = "picking";
      else if (action === "pack") soStatus = "packed";
      else if (action === "ship") soStatus = allShipped ? "shipped" : "picking";
      else if (action === "deliver" && allShipped) soStatus = "delivered";
      if (soStatus) {
        await tx.update(salesOrders).set({ status: soStatus, updatedAt: new Date() }).where(eq(salesOrders.id, shipment.salesOrderId));
      }

      await emitEvent(tx, {
        workspaceId: shipment.workspaceId,
        eventType: EVENT[action],
        aggregateType: "shipment",
        aggregateId: shipment.id,
        actorUserId: session.user.id,
        payload: { salesOrderId: shipment.salesOrderId },
      });
    });

    dispatchInline();
    return ok({ id, status: NEXT[action] });
  }, { route: "POST /api/shipments/[id]/transition" });
}
