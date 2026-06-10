import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders, vendors } from "@/lib/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { parseListParams, likePattern } from "@/lib/services/list-query";
import { createPurchaseOrderSchema } from "@/lib/validations";
import { writePoLinesAndTotals } from "@/lib/services/purchasing";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { resolveAndValidateScope, LinkPolicyError } from "@/lib/services/linking";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/purchase-orders?workspaceId=...&status=&vendorId= — list POs
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessPurchasing", session.user.role)))
      return forbidden();

    const status = url.searchParams.get("status");
    const vendorId = url.searchParams.get("vendorId");
    const conds = [eq(purchaseOrders.workspaceId, workspaceId)];
    const lq = parseListParams(url);
    if (lq.q) conds.push(or(ilike(purchaseOrders.docNumber, likePattern(lq.q)))!);
    if (status) conds.push(eq(purchaseOrders.status, status as typeof purchaseOrders.$inferSelect.status));
    if (vendorId) conds.push(eq(purchaseOrders.vendorId, vendorId));

    const rows = await db
      .select({
        id: purchaseOrders.id,
        docNumber: purchaseOrders.docNumber,
        status: purchaseOrders.status,
        vendorId: purchaseOrders.vendorId,
        vendorName: vendors.name,
        totalMinor: purchaseOrders.totalMinor,
        currency: purchaseOrders.currency,
        expectedDate: purchaseOrders.expectedDate,
        createdAt: purchaseOrders.createdAt,
      })
      .from(purchaseOrders)
      .leftJoin(vendors, eq(vendors.id, purchaseOrders.vendorId))
      .where(and(...conds))
      .orderBy(desc(purchaseOrders.createdAt)).offset(lq.offset).limit(lq.limit ?? 100000);
    return ok({ data: rows });
  }, { route: "GET /api/purchase-orders" });
}

// POST /api/purchase-orders — create a draft PO with line items
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createPurchaseOrderSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessPurchasing", session.user.role)))
      return forbidden();

    // Vendor must belong to the same workspace.
    const [vendor] = await db.select().from(vendors).where(eq(vendors.id, input.vendorId)).limit(1);
    if (!vendor || vendor.workspaceId !== input.workspaceId) return badRequest("Invalid vendor");

    let scope;
    try {
      scope = await resolveAndValidateScope("purchase_order", {
        workspaceId: input.workspaceId,
        boardId: input.boardId ?? null,
        groupId: input.groupId ?? null,
        itemId: input.itemId ?? null,
      });
    } catch (err) {
      if (err instanceof LinkPolicyError) return badRequest(err.message);
      throw err;
    }

    const po = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: input.workspaceId, docType: "purchase_order" });
      const [row] = await tx
        .insert(purchaseOrders)
        .values({
          workspaceId: input.workspaceId,
          vendorId: input.vendorId,
          docNumber,
          status: "draft",
          expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
          orderDate: input.orderDate ? new Date(input.orderDate) : new Date(),
          notes: input.notes || null,
          reference: input.reference || null,
          paymentTermsLabel: input.paymentTermsLabel || "due_on_receipt",
          shipmentPreference: input.shipmentPreference || null,
          reverseCharge: input.reverseCharge ?? false,
          deliveryAddressType: input.deliveryAddressType ?? "organization",
          deliveryCustomerId: input.deliveryCustomerId || null,
          deliveryAddress: input.deliveryAddress ?? {},
          adjustmentLabel: "Adjustment",
          termsConditions: input.termsConditions || null,
          attachments: input.attachments ?? [],
          boardId: scope.boardId,
          groupId: scope.groupId,
          itemId: scope.itemId,
          linkLevel: scope.linkLevel,
          createdBy: session.user.id,
        })
        .returning();
      await writePoLinesAndTotals(tx, input.workspaceId, row.id, input.lines, {
        discountType: input.discountType,
        discountValue: input.discountValue,
        withholdingType: input.withholdingType ?? null,
        withholdingTaxRateId: input.withholdingTaxRateId ?? null,
        adjustment: input.adjustment,
      });
      return row;
    });

    dispatchInline();
    return created(po);
  }, { route: "POST /api/purchase-orders" });
}
