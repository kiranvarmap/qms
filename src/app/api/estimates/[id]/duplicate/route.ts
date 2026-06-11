import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimates, estimateLineItems } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { nextDocNumber } from "@/lib/services/document-sequence";

// POST /api/estimates/[id]/duplicate — clone into a fresh draft (audit P3:
// no document anywhere could be duplicated). Lines and pricing copy verbatim;
// lifecycle fields reset.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [src] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
    if (!src) return notFound();
    if (!(await hasModuleAccess(src.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const lines = await db
      .select()
      .from(estimateLineItems)
      .where(eq(estimateLineItems.estimateId, id))
      .orderBy(asc(estimateLineItems.position));

    const copy = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: src.workspaceId, docType: "estimate" });
      const [est] = await tx
        .insert(estimates)
        .values({
          workspaceId: src.workspaceId,
          customerId: src.customerId,
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
        await tx.insert(estimateLineItems).values({
          estimateId: est.id,
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          taxRateId: l.taxRateId,
          lineTaxMinor: l.lineTaxMinor,
          amountMinor: l.amountMinor,
          position: l.position,
        });
      }
      return est;
    });

    return created(copy);
  }, { route: "POST /api/estimates/[id]/duplicate" });
}
