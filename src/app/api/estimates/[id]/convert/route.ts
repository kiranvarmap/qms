import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimates, estimateLineItems, salesOrders, salesOrderLineItems, invoices, invoiceLineItems, entityLinks } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { convertEstimateSchema } from "@/lib/validations";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/estimates/[id]/convert { target } — one-way conversion of an
// accepted estimate. target "sales_order" implemented here (Phase 5);
// "invoice" lands with Phase 6. Copies line items and links via entity_links
// (converted_from). No stock impact (Plan §6.3).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const { target } = convertEstimateSchema.parse(await req.json());

    const [est] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
    if (!est) return notFound();
    if (!(await hasModuleAccess(est.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (est.status === "converted") return conflict("Estimate already converted");
    if (est.status !== "accepted") return conflict("Only accepted estimates can be converted");

    const lines = await db
      .select()
      .from(estimateLineItems)
      .where(eq(estimateLineItems.estimateId, id))
      .orderBy(asc(estimateLineItems.position));

    if (target === "invoice") {
      const invoice = await db.transaction(async (tx) => {
        const docNumber = await nextDocNumber(tx, { workspaceId: est.workspaceId, docType: "invoice" });
        const [row] = await tx
          .insert(invoices)
          .values({
            workspaceId: est.workspaceId,
            customerId: est.customerId,
            docNumber,
            status: "draft",
            subtotalMinor: est.subtotalMinor,
            taxMinor: est.taxMinor,
            totalMinor: est.totalMinor,
            currency: est.currency,
            boardId: est.boardId,
            groupId: est.groupId,
            itemId: est.itemId,
            linkLevel: est.linkLevel,
            createdBy: session.user.id,
          })
          .returning();
        if (lines.length > 0) {
          await tx.insert(invoiceLineItems).values(
            lines.map((l, i) => ({
              invoiceId: row.id,
              productId: l.productId,
              description: l.description,
              quantity: l.quantity,
              unitPriceMinor: l.unitPriceMinor,
              taxRateId: l.taxRateId,
              amountMinor: l.amountMinor,
              lineTaxMinor: l.lineTaxMinor,
              position: i,
            }))
          );
        }
        await tx
          .update(estimates)
          .set({ status: "converted", convertedToType: "invoice", convertedToId: row.id, updatedAt: new Date() })
          .where(eq(estimates.id, id));
        await tx
          .insert(entityLinks)
          .values({
            workspaceId: est.workspaceId,
            sourceType: "invoice",
            sourceId: row.id,
            targetType: "estimate",
            targetId: est.id,
            relation: "converted_from",
            createdBy: session.user.id,
          })
          .onConflictDoNothing();
        await emitEvent(tx, {
          workspaceId: est.workspaceId,
          eventType: "estimate.converted",
          aggregateType: "estimate",
          aggregateId: est.id,
          actorUserId: session.user.id,
          payload: { target: "invoice", invoiceId: row.id, boardId: est.boardId, itemId: est.itemId },
        });
        await emitEvent(tx, {
          workspaceId: est.workspaceId,
          eventType: "invoice.created",
          aggregateType: "invoice",
          aggregateId: row.id,
          actorUserId: session.user.id,
          payload: { docNumber: row.docNumber, customerId: row.customerId, boardId: row.boardId, itemId: row.itemId },
        });
        return row;
      });
      dispatchInline();
      return ok({ id, status: "converted", invoiceId: invoice.id });
    }

    const so = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: est.workspaceId, docType: "sales_order" });
      const [row] = await tx
        .insert(salesOrders)
        .values({
          workspaceId: est.workspaceId,
          customerId: est.customerId,
          docNumber,
          estimateId: est.id,
          status: "draft",
          subtotalMinor: est.subtotalMinor,
          taxMinor: est.taxMinor,
          totalMinor: est.totalMinor,
          currency: est.currency,
          boardId: est.boardId,
          groupId: est.groupId,
          itemId: est.itemId,
          linkLevel: est.linkLevel,
          createdBy: session.user.id,
        })
        .returning();

      if (lines.length > 0) {
        await tx.insert(salesOrderLineItems).values(
          lines.map((l, i) => ({
            salesOrderId: row.id,
            productId: l.productId,
            description: l.description,
            quantity: l.quantity,
            unitPriceMinor: l.unitPriceMinor,
            taxRateId: l.taxRateId,
            amountMinor: l.amountMinor,
            lineTaxMinor: l.lineTaxMinor,
            position: i,
          }))
        );
      }

      await tx
        .update(estimates)
        .set({ status: "converted", convertedToType: "sales_order", convertedToId: row.id, updatedAt: new Date() })
        .where(eq(estimates.id, id));

      await tx
        .insert(entityLinks)
        .values({
          workspaceId: est.workspaceId,
          sourceType: "sales_order",
          sourceId: row.id,
          targetType: "estimate",
          targetId: est.id,
          relation: "converted_from",
          createdBy: session.user.id,
        })
        .onConflictDoNothing();

      await emitEvent(tx, {
        workspaceId: est.workspaceId,
        eventType: "estimate.converted",
        aggregateType: "estimate",
        aggregateId: est.id,
        actorUserId: session.user.id,
        payload: { target: "sales_order", salesOrderId: row.id, boardId: est.boardId, itemId: est.itemId },
      });

      return row;
    });

    dispatchInline();
    return ok({ id, status: "converted", salesOrderId: so.id });
  }, { route: "POST /api/estimates/[id]/convert" });
}
