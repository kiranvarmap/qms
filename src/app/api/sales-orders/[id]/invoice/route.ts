import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesOrders, salesOrderLineItems, invoices, invoiceLineItems, entityLinks } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { taxOf, sumMinor } from "@/lib/money";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";
import { taxRates } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

// POST /api/sales-orders/[id]/invoice — bill the shipped-but-unbilled quantities
// (Plan §6.2). qtyInvoiced prevents double-billing, parallel to qtyShipped.
// No stock impact (Plan §6.3) — the invoice only references shipped goods.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
    if (!so) return notFound();
    if (!(await hasModuleAccess(so.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const soLines = await db
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, id))
      .orderBy(asc(salesOrderLineItems.position));

    const billable = soLines
      .map((l) => ({ line: l, qty: l.qtyShipped - l.qtyInvoiced }))
      .filter((x) => x.qty > 1e-9);
    if (billable.length === 0) return conflict("Nothing new to invoice (ship goods first)");

    // Resolve tax rates for the billable lines.
    const taxIds = [...new Set(billable.map((b) => b.line.taxRateId).filter(Boolean) as string[])];
    const rateMap = new Map<string, number>();
    if (taxIds.length > 0) {
      const rows = await db.select().from(taxRates).where(inArray(taxRates.id, taxIds));
      for (const r of rows) rateMap.set(r.id, r.rateBasisPoints);
    }

    const invoice = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: so.workspaceId, docType: "invoice" });
      const [row] = await tx
        .insert(invoices)
        .values({
          workspaceId: so.workspaceId,
          customerId: so.customerId,
          docNumber,
          status: "draft",
          salesOrderId: so.id,
          currency: so.currency,
          boardId: so.boardId,
          groupId: so.groupId,
          itemId: so.itemId,
          linkLevel: so.linkLevel,
          createdBy: session.user.id,
        })
        .returning();

      const nets: number[] = [];
      const taxes: number[] = [];
      await tx.insert(invoiceLineItems).values(
        billable.map((b, i) => {
          const net = Math.round(b.qty * b.line.unitPriceMinor);
          const bp = b.line.taxRateId ? rateMap.get(b.line.taxRateId) ?? 0 : 0;
          const tax = taxOf(net, bp);
          nets.push(net);
          taxes.push(tax);
          return {
            invoiceId: row.id,
            productId: b.line.productId,
            salesOrderLineId: b.line.id,
            description: b.line.description,
            quantity: b.qty,
            unitPriceMinor: b.line.unitPriceMinor,
            taxRateId: b.line.taxRateId,
            amountMinor: net,
            lineTaxMinor: tax,
            position: i,
          };
        })
      );

      const subtotalMinor = sumMinor(nets);
      const taxMinor = sumMinor(taxes);
      await tx
        .update(invoices)
        .set({ subtotalMinor, taxMinor, totalMinor: subtotalMinor + taxMinor, updatedAt: new Date() })
        .where(eq(invoices.id, row.id));

      // Advance qtyInvoiced on each SO line.
      for (const b of billable) {
        await tx
          .update(salesOrderLineItems)
          .set({ qtyInvoiced: b.line.qtyInvoiced + b.qty })
          .where(eq(salesOrderLineItems.id, b.line.id));
      }

      // Mark SO invoiced when every line is fully billed.
      const refreshed = await tx.select().from(salesOrderLineItems).where(eq(salesOrderLineItems.salesOrderId, id));
      const allInvoiced = refreshed.every((l) => l.qtyInvoiced >= l.quantity - 1e-9);
      if (allInvoiced) {
        await tx.update(salesOrders).set({ status: "invoiced", updatedAt: new Date() }).where(eq(salesOrders.id, id));
        await emitEvent(tx, {
          workspaceId: so.workspaceId,
          eventType: "salesorder.invoiced",
          aggregateType: "sales_order",
          aggregateId: so.id,
          actorUserId: session.user.id,
          payload: { docNumber: so.docNumber, invoiceId: row.id },
        });
      }

      await tx
        .insert(entityLinks)
        .values({
          workspaceId: so.workspaceId,
          sourceType: "invoice",
          sourceId: row.id,
          targetType: "sales_order",
          targetId: so.id,
          relation: "converted_from",
          createdBy: session.user.id,
        })
        .onConflictDoNothing();

      await emitEvent(tx, {
        workspaceId: so.workspaceId,
        eventType: "invoice.created",
        aggregateType: "invoice",
        aggregateId: row.id,
        actorUserId: session.user.id,
        payload: { docNumber: row.docNumber, customerId: row.customerId, salesOrderId: so.id, boardId: row.boardId, itemId: row.itemId },
      });

      return row;
    });

    dispatchInline();
    return ok({ invoiceId: invoice.id, docNumber: invoice.docNumber });
  }, { route: "POST /api/sales-orders/[id]/invoice" });
}
