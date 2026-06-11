import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders, poLineItems } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { nextDocNumber } from "@/lib/services/document-sequence";

// POST /api/purchase-orders/[id]/duplicate — clone into a fresh draft
// (audit P3). Lines copy with receipt progress reset; approval state resets.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [src] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!src) return notFound();
    if (!(await hasModuleAccess(src.workspaceId, session.user.id, "canAccessPurchasing", session.user.role)))
      return forbidden();

    const lines = await db
      .select()
      .from(poLineItems)
      .where(eq(poLineItems.purchaseOrderId, id))
      .orderBy(asc(poLineItems.position));

    const copy = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: src.workspaceId, docType: "purchase_order" });
      const [po] = await tx
        .insert(purchaseOrders)
        .values({
          workspaceId: src.workspaceId,
          vendorId: src.vendorId,
          docNumber,
          status: "draft",
          currency: src.currency,
          subtotalMinor: src.subtotalMinor,
          taxMinor: src.taxMinor,
          totalMinor: src.totalMinor,
          notes: src.notes,
          boardId: src.boardId,
          groupId: src.groupId,
          itemId: src.itemId,
          linkLevel: src.linkLevel,
          createdBy: session.user.id,
        })
        .returning();
      for (const l of lines) {
        await tx.insert(poLineItems).values({
          purchaseOrderId: po.id,
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitCostMinor: l.unitCostMinor,
          taxRateId: l.taxRateId,
          lineTaxMinor: l.lineTaxMinor,
          amountMinor: l.amountMinor,
          position: l.position,
        });
      }
      return po;
    });

    return created(copy);
  }, { route: "POST /api/purchase-orders/[id]/duplicate" });
}
