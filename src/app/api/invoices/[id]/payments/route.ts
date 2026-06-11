import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices, payments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { recordPaymentSchema } from "@/lib/validations";
import { paymentStatus } from "@/lib/services/invoices";
import { toMinor } from "@/lib/money";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/invoices/[id]/payments — list payments
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const rows = await db.select().from(payments).where(eq(payments.invoiceId, id));
    return ok({ data: rows });
  }, { route: "GET /api/invoices/[id]/payments" });
}

// POST /api/invoices/[id]/payments — record a MANUAL/offline payment (no gateway).
// Updates amountPaid + status (partially_paid / paid) and emits events.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (inv.status === "void" || inv.status === "draft")
      return conflict("Send the invoice before recording payments");

    const input = recordPaymentSchema.parse(await req.json());
    const amountMinor = toMinor(input.amount);

    const result = await db.transaction(async (tx) => {
      const [payment] = await tx
        .insert(payments)
        .values({
          workspaceId: inv.workspaceId,
          invoiceId: inv.id,
          amountMinor,
          method: input.method,
          reference: input.reference || null,
          receivedDate: input.receivedDate ? new Date(input.receivedDate) : new Date(),
          note: input.note || null,
          recordedBy: session.user.id,
        })
        .returning();

      const newPaid = inv.amountPaidMinor + amountMinor;
      const newStatus = paymentStatus(newPaid, inv.totalMinor);
      await tx
        .update(invoices)
        .set({ amountPaidMinor: newPaid, status: newStatus, updatedAt: new Date() })
        .where(eq(invoices.id, inv.id));

      await emitEvent(tx, {
        workspaceId: inv.workspaceId,
        eventType: "payment.recorded",
        aggregateType: "payment",
        aggregateId: payment.id,
        actorUserId: session.user.id,
        payload: { invoiceId: inv.id, docNumber: inv.docNumber, amountMinor, boardId: inv.boardId, itemId: inv.itemId },
      });
      if (newStatus === "paid") {
        await emitEvent(tx, {
          workspaceId: inv.workspaceId,
          eventType: "invoice.paid",
          aggregateType: "invoice",
          aggregateId: inv.id,
          actorUserId: session.user.id,
          payload: { docNumber: inv.docNumber, customerId: inv.customerId, boardId: inv.boardId, itemId: inv.itemId },
        });
      }
      return { payment, status: newStatus, amountPaidMinor: newPaid };
    });

    dispatchInline();
    return created(result);
  }, { route: "POST /api/invoices/[id]/payments" });
}
