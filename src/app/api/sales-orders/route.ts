import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesOrders, customers } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createSalesOrderSchema } from "@/lib/validations";
import { writeSalesOrderLinesAndTotals } from "@/lib/services/sales-orders";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { resolveAndValidateScope, LinkPolicyError } from "@/lib/services/linking";

// GET /api/sales-orders?workspaceId=...&status=&customerId= — list sales orders
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
    const conds = [eq(salesOrders.workspaceId, workspaceId)];
    if (status) conds.push(eq(salesOrders.status, status as typeof salesOrders.$inferSelect.status));
    if (customerId) conds.push(eq(salesOrders.customerId, customerId));

    const rows = await db
      .select({
        id: salesOrders.id,
        docNumber: salesOrders.docNumber,
        status: salesOrders.status,
        customerId: salesOrders.customerId,
        customerName: customers.name,
        totalMinor: salesOrders.totalMinor,
        currency: salesOrders.currency,
        createdAt: salesOrders.createdAt,
      })
      .from(salesOrders)
      .leftJoin(customers, eq(customers.id, salesOrders.customerId))
      .where(and(...conds))
      .orderBy(desc(salesOrders.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/sales-orders" });
}

// POST /api/sales-orders — create a draft sales order with line items
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createSalesOrderSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer || customer.workspaceId !== input.workspaceId) return badRequest("Invalid customer");

    let scope;
    try {
      scope = await resolveAndValidateScope("sales_order", {
        workspaceId: input.workspaceId,
        boardId: input.boardId ?? null,
        groupId: input.groupId ?? null,
        itemId: input.itemId ?? null,
      });
    } catch (err) {
      if (err instanceof LinkPolicyError) return badRequest(err.message);
      throw err;
    }

    const so = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: input.workspaceId, docType: "sales_order" });
      const [row] = await tx
        .insert(salesOrders)
        .values({
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          docNumber,
          status: "draft",
          warehouseId: input.warehouseId || null,
          notes: input.notes || null,
          reference: input.reference || null,
          subject: input.subject || null,
          salespersonEmployeeId: input.salespersonEmployeeId || null,
          projectId: input.projectId || null,
          adjustmentLabel: "Adjustment",
          customerNotes: input.customerNotes || null,
          termsConditions: input.termsConditions || null,
          attachments: input.attachments ?? [],
          boardId: scope.boardId,
          groupId: scope.groupId,
          itemId: scope.itemId,
          linkLevel: scope.linkLevel,
          createdBy: session.user.id,
        })
        .returning();
      await writeSalesOrderLinesAndTotals(tx, input.workspaceId, row.id, input.lines, {
        discountType: input.discountType,
        discountValue: input.discountValue,
        withholdingType: input.withholdingType ?? null,
        withholdingTaxRateId: input.withholdingTaxRateId ?? null,
        adjustment: input.adjustment,
        roundOff: input.roundOff,
      });
      return row;
    });

    return created(so);
  }, { route: "POST /api/sales-orders" });
}
