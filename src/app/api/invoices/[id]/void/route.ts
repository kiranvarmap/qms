import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { voidInvoiceSchema } from "@/lib/validations";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/invoices/[id]/void — cancel an issued invoice without deleting it
// (audit 02 §4: `void` was an unreachable status, forcing audit-hostile hard
// deletes). Allowed from draft/sent/overdue; never once money is recorded —
// payments must be reversed (or a credit note raised) first.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    if (inv.status === "void") return ok({ id, status: "void" }); // idempotent
    if (inv.status === "paid" || inv.status === "partially_paid" || inv.amountPaidMinor > 0)
      return conflict("Invoices with recorded payments cannot be voided — reverse the payments or raise a credit note");
    if (inv.status !== "draft" && inv.status !== "sent" && inv.status !== "overdue")
      return conflict(`Cannot void an invoice in status "${inv.status}"`);

    const body = await req.json().catch(() => ({}));
    const { reason } = voidInvoiceSchema.parse(body ?? {});
    if (inv.status !== "draft" && !reason) return badRequest("A reason is required to void an issued invoice");

    await db.transaction(async (tx) => {
      await tx
        .update(invoices)
        .set({ status: "void", customerVisible: false, updatedAt: new Date() })
        .where(eq(invoices.id, id));
      await emitEvent(tx, {
        workspaceId: inv.workspaceId,
        eventType: "invoice.voided",
        aggregateType: "invoice",
        aggregateId: inv.id,
        actorUserId: session.user.id,
        payload: {
          docNumber: inv.docNumber,
          customerId: inv.customerId,
          boardId: inv.boardId,
          itemId: inv.itemId,
          reason: reason ?? null,
          summary: reason ? `Invoice voided: ${reason}` : undefined,
        },
      });
    });

    dispatchInline();
    return ok({ id, status: "void" });
  }, { route: "POST /api/invoices/[id]/void" });
}
