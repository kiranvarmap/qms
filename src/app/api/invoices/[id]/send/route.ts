import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/invoices/[id]/send — issue a draft invoice to the customer.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (inv.status !== "draft") return conflict("Only draft invoices can be sent");

    await db.transaction(async (tx) => {
      await tx
        .update(invoices)
        .set({ status: "sent", sentAt: new Date(), customerVisible: true, updatedAt: new Date() })
        .where(eq(invoices.id, id));
      await emitEvent(tx, {
        workspaceId: inv.workspaceId,
        eventType: "invoice.sent",
        aggregateType: "invoice",
        aggregateId: inv.id,
        actorUserId: session.user.id,
        payload: { docNumber: inv.docNumber, customerId: inv.customerId, boardId: inv.boardId, itemId: inv.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "sent" });
  }, { route: "POST /api/invoices/[id]/send" });
}
