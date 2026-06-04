import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized } from "@/lib/api";
import { getPortalSession } from "@/lib/services/portal-auth";

// GET /api/portal/invoices — the session customer's visible invoices (read-only).
export async function GET() {
  return apiHandler(async () => {
    const s = await getPortalSession();
    if (!s) return unauthorized();

    const rows = await db
      .select({
        id: invoices.id,
        docNumber: invoices.docNumber,
        status: invoices.status,
        totalMinor: invoices.totalMinor,
        amountPaidMinor: invoices.amountPaidMinor,
        currency: invoices.currency,
        dueDate: invoices.dueDate,
        createdAt: invoices.createdAt,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.workspaceId, s.workspaceId),
          eq(invoices.customerId, s.customerId),
          eq(invoices.customerVisible, true)
        )
      )
      .orderBy(desc(invoices.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/portal/invoices" });
}
