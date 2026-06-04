import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices, customers } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createInvoiceSchema } from "@/lib/validations";
import { writeInvoiceLinesAndTotals } from "@/lib/services/invoices";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { resolveAndValidateScope, LinkPolicyError } from "@/lib/services/linking";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/invoices?workspaceId=...&status=&customerId= — list invoices
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const status = url.searchParams.get("status");
    const customerId = url.searchParams.get("customerId");
    const conds = [eq(invoices.workspaceId, workspaceId)];
    if (status) conds.push(eq(invoices.status, status as typeof invoices.$inferSelect.status));
    if (customerId) conds.push(eq(invoices.customerId, customerId));

    const rows = await db
      .select({
        id: invoices.id,
        docNumber: invoices.docNumber,
        status: invoices.status,
        customerId: invoices.customerId,
        customerName: customers.name,
        totalMinor: invoices.totalMinor,
        amountPaidMinor: invoices.amountPaidMinor,
        currency: invoices.currency,
        dueDate: invoices.dueDate,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .leftJoin(customers, eq(customers.id, invoices.customerId))
      .where(and(...conds))
      .orderBy(desc(invoices.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/invoices" });
}

// POST /api/invoices — create a draft invoice with line items
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createInvoiceSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer || customer.workspaceId !== input.workspaceId) return badRequest("Invalid customer");

    let scope;
    try {
      scope = await resolveAndValidateScope("invoice", {
        workspaceId: input.workspaceId,
        boardId: input.boardId ?? null,
        groupId: input.groupId ?? null,
        itemId: input.itemId ?? null,
      });
    } catch (err) {
      if (err instanceof LinkPolicyError) return badRequest(err.message);
      throw err;
    }

    const invoice = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: input.workspaceId, docType: "invoice" });
      const [row] = await tx
        .insert(invoices)
        .values({
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          docNumber,
          status: "draft",
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes || null,
          boardId: scope.boardId,
          groupId: scope.groupId,
          itemId: scope.itemId,
          linkLevel: scope.linkLevel,
          createdBy: session.user.id,
        })
        .returning();
      await writeInvoiceLinesAndTotals(tx, input.workspaceId, row.id, input.lines);
      await emitEvent(tx, {
        workspaceId: input.workspaceId,
        eventType: "invoice.created",
        aggregateType: "invoice",
        aggregateId: row.id,
        actorUserId: session.user.id,
        payload: { docNumber: row.docNumber, customerId: row.customerId, boardId: row.boardId, itemId: row.itemId },
      });
      return row;
    });

    dispatchInline();
    return created(invoice);
  }, { route: "POST /api/invoices" });
}
