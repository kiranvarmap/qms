import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimates, customers } from "@/lib/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { parseListParams, likePattern } from "@/lib/services/list-query";
import { createEstimateSchema } from "@/lib/validations";
import { writeEstimateLinesAndTotals } from "@/lib/services/estimates";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { resolveAndValidateScope, LinkPolicyError } from "@/lib/services/linking";

// GET /api/estimates?workspaceId=...&status=&customerId= — list estimates
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
    const conds = [eq(estimates.workspaceId, workspaceId)];
    const lq = parseListParams(url);
    if (lq.q) conds.push(or(ilike(estimates.docNumber, likePattern(lq.q)))!);
    if (status) conds.push(eq(estimates.status, status as typeof estimates.$inferSelect.status));
    if (customerId) conds.push(eq(estimates.customerId, customerId));

    const rows = await db
      .select({
        id: estimates.id,
        docNumber: estimates.docNumber,
        status: estimates.status,
        version: estimates.version,
        customerId: estimates.customerId,
        customerName: customers.name,
        totalMinor: estimates.totalMinor,
        currency: estimates.currency,
        validUntil: estimates.validUntil,
        createdAt: estimates.createdAt,
      })
      .from(estimates)
      .leftJoin(customers, eq(customers.id, estimates.customerId))
      .where(and(...conds))
      .orderBy(desc(estimates.createdAt)).offset(lq.offset).limit(lq.limit ?? 100000);
    return ok({ data: rows });
  }, { route: "GET /api/estimates" });
}

// POST /api/estimates — create a draft estimate with line items
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createEstimateSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer || customer.workspaceId !== input.workspaceId) return badRequest("Invalid customer");

    let scope;
    try {
      scope = await resolveAndValidateScope("estimate", {
        workspaceId: input.workspaceId,
        boardId: input.boardId ?? null,
        groupId: input.groupId ?? null,
        itemId: input.itemId ?? null,
      });
    } catch (err) {
      if (err instanceof LinkPolicyError) return badRequest(err.message);
      throw err;
    }

    const estimate = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: input.workspaceId, docType: "estimate" });
      const [row] = await tx
        .insert(estimates)
        .values({
          workspaceId: input.workspaceId,
          customerId: input.customerId,
          docNumber,
          status: "draft",
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
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
      await writeEstimateLinesAndTotals(tx, input.workspaceId, row.id, input.lines, {
        discountType: input.discountType,
        discountValue: input.discountValue,
        withholdingType: input.withholdingType ?? null,
        withholdingTaxRateId: input.withholdingTaxRateId ?? null,
        adjustment: input.adjustment,
        roundOff: input.roundOff,
      });
      return row;
    });

    return created(estimate);
  }, { route: "POST /api/estimates" });
}
