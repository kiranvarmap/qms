import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  invoices, purchaseOrders, products, stockLevels, salesOrders, estimates,
  approvalRequests, leaveRequests, expenses, employees, certificationRecords, enrollments,
} from "@/lib/db/schema";
import { and, count, eq, inArray, sql } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { getMembership } from "@/lib/services/access";

const n = (v: unknown) => Number(v ?? 0);

// GET /api/reports/summary?workspaceId=... — cross-module KPI roll-up (Plan §11).
// Read-model only: aggregates domain tables, filtered by workspaceId.
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const ws = new URL(req.url).searchParams.get("workspaceId");
    if (!ws) return badRequest("workspaceId required");
    if (session.user.role !== "admin" && !(await getMembership(ws, session.user.id))) return forbidden();

    // ── Finance ──────────────────────────────────────────────────────
    const [arRow] = await db
      .select({ outstanding: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}), 0)` })
      .from(invoices)
      .where(and(eq(invoices.workspaceId, ws), inArray(invoices.status, ["sent", "partially_paid", "overdue"])));
    const [overdueRow] = await db
      .select({ c: count() })
      .from(invoices)
      .where(and(eq(invoices.workspaceId, ws), eq(invoices.status, "overdue")));
    const [collectedRow] = await db
      .select({ paid: sql<number>`coalesce(sum(${invoices.amountPaidMinor}), 0)` })
      .from(invoices)
      .where(eq(invoices.workspaceId, ws));

    // ── Procurement ──────────────────────────────────────────────────
    const openPoStatuses = ["pending_approval", "approved", "sent", "partially_received"] as const;
    const [poRow] = await db
      .select({ c: count(), committed: sql<number>`coalesce(sum(${purchaseOrders.totalMinor}), 0)` })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.workspaceId, ws), inArray(purchaseOrders.status, [...openPoStatuses])));

    // ── Inventory (per-product roll-up) ──────────────────────────────
    const prodRows = await db
      .select({
        id: products.id,
        costMinor: products.costMinor,
        reorderLevel: products.reorderLevel,
        track: products.trackInventory,
        onHand: sql<number>`coalesce(sum(${stockLevels.onHand}), 0)`,
        committed: sql<number>`coalesce(sum(${stockLevels.committed}), 0)`,
      })
      .from(products)
      .leftJoin(stockLevels, eq(stockLevels.productId, products.id))
      .where(eq(products.workspaceId, ws))
      .groupBy(products.id);
    let lowStock = 0;
    let stockValueMinor = 0;
    for (const p of prodRows) {
      const onHand = n(p.onHand);
      const avail = onHand - n(p.committed);
      if (p.track && p.reorderLevel > 0 && avail < p.reorderLevel) lowStock++;
      stockValueMinor += Math.round(onHand * p.costMinor);
    }

    // ── Sales ────────────────────────────────────────────────────────
    const [soRow] = await db
      .select({ c: count() })
      .from(salesOrders)
      .where(and(eq(salesOrders.workspaceId, ws), inArray(salesOrders.status, ["draft", "pending_approval", "approved", "reserved", "picking", "packed", "shipped"])));
    const [pipeRow] = await db
      .select({ v: sql<number>`coalesce(sum(${estimates.totalMinor}), 0)` })
      .from(estimates)
      .where(and(eq(estimates.workspaceId, ws), inArray(estimates.status, ["sent", "viewed", "accepted"])));

    // ── People ───────────────────────────────────────────────────────
    const [apprRow] = await db.select({ c: count() }).from(approvalRequests).where(and(eq(approvalRequests.workspaceId, ws), eq(approvalRequests.status, "pending")));
    const [leaveRow] = await db.select({ c: count() }).from(leaveRequests).where(and(eq(leaveRequests.workspaceId, ws), eq(leaveRequests.status, "pending")));
    const [expRow] = await db.select({ c: count() }).from(expenses).where(and(eq(expenses.workspaceId, ws), eq(expenses.status, "submitted")));
    const [headRow] = await db.select({ c: count() }).from(employees).where(eq(employees.workspaceId, ws));

    // ── Training ─────────────────────────────────────────────────────
    const [certRow] = await db.select({ c: count() }).from(certificationRecords).where(and(eq(certificationRecords.workspaceId, ws), eq(certificationRecords.status, "expiring")));
    const [enrComplete] = await db.select({ c: count() }).from(enrollments).where(and(eq(enrollments.workspaceId, ws), eq(enrollments.status, "completed")));
    const [enrTotal] = await db.select({ c: count() }).from(enrollments).where(eq(enrollments.workspaceId, ws));

    return ok({
      finance: { outstandingMinor: n(arRow?.outstanding), overdueCount: n(overdueRow?.c), collectedMinor: n(collectedRow?.paid) },
      procurement: { openPoCount: n(poRow?.c), committedSpendMinor: n(poRow?.committed) },
      inventory: { productCount: prodRows.length, lowStockCount: lowStock, stockValueMinor },
      sales: { openOrderCount: n(soRow?.c), pipelineMinor: n(pipeRow?.v) },
      people: { pendingApprovals: n(apprRow?.c), pendingLeave: n(leaveRow?.c), pendingExpenses: n(expRow?.c), headcount: n(headRow?.c) },
      training: { certsExpiring: n(certRow?.c), enrollmentsCompleted: n(enrComplete?.c), enrollmentsTotal: n(enrTotal?.c) },
    });
  }, { route: "GET /api/reports/summary" });
}
