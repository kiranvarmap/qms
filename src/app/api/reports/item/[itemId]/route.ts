import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { items, purchaseOrders, expenses, invoices, estimates, salesOrders, activityFeed } from "@/lib/db/schema";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { getMembership } from "@/lib/services/access";

const n = (v: unknown) => Number(v ?? 0);

// GET /api/reports/item/[itemId] — Project 360° finance roll-up for a board
// item (Plan §11). Everything is already linked via the scope ladder, so this
// is one indexed read per domain + the unified activity feed.
export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { itemId } = await params;

    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    if (!item) return notFound();
    if (!item.workspaceId) return forbidden();
    if (session.user.role !== "admin" && !(await getMembership(item.workspaceId, session.user.id))) return forbidden();

    const [po] = await db
      .select({ c: count(), total: sql<number>`coalesce(sum(${purchaseOrders.totalMinor}), 0)` })
      .from(purchaseOrders).where(eq(purchaseOrders.itemId, itemId));
    const [exp] = await db
      .select({ c: count(), total: sql<number>`coalesce(sum(${expenses.amountMinor}), 0)` })
      .from(expenses).where(eq(expenses.itemId, itemId));
    const [inv] = await db
      .select({ c: count(), total: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)`, paid: sql<number>`coalesce(sum(${invoices.amountPaidMinor}), 0)` })
      .from(invoices).where(eq(invoices.itemId, itemId));
    const [est] = await db
      .select({ c: count(), total: sql<number>`coalesce(sum(${estimates.totalMinor}), 0)` })
      .from(estimates).where(eq(estimates.itemId, itemId));
    const [so] = await db
      .select({ c: count(), total: sql<number>`coalesce(sum(${salesOrders.totalMinor}), 0)` })
      .from(salesOrders).where(eq(salesOrders.itemId, itemId));

    const feed = await db
      .select()
      .from(activityFeed)
      .where(and(eq(activityFeed.itemId, itemId)))
      .orderBy(desc(activityFeed.occurredAt))
      .limit(30);

    return ok({
      item: { id: item.id, name: item.name },
      finance: {
        purchaseOrders: { count: n(po?.c), totalMinor: n(po?.total) },
        expenses: { count: n(exp?.c), totalMinor: n(exp?.total) },
        invoices: { count: n(inv?.c), totalMinor: n(inv?.total), paidMinor: n(inv?.paid) },
        estimates: { count: n(est?.c), totalMinor: n(est?.total) },
        salesOrders: { count: n(so?.c), totalMinor: n(so?.total) },
      },
      activity: feed,
    });
  }, { route: "GET /api/reports/item/[itemId]" });
}
