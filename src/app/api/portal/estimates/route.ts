import { db } from "@/lib/db";
import { estimates } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized } from "@/lib/api";
import { getPortalSession } from "@/lib/services/portal-auth";

// GET /api/portal/estimates — the session customer's visible estimates only.
export async function GET() {
  return apiHandler(async () => {
    const s = await getPortalSession();
    if (!s) return unauthorized();

    const rows = await db
      .select({
        id: estimates.id,
        docNumber: estimates.docNumber,
        status: estimates.status,
        totalMinor: estimates.totalMinor,
        currency: estimates.currency,
        validUntil: estimates.validUntil,
        createdAt: estimates.createdAt,
      })
      .from(estimates)
      .where(
        and(
          eq(estimates.workspaceId, s.workspaceId),
          eq(estimates.customerId, s.customerId),
          eq(estimates.customerVisible, true)
        )
      )
      .orderBy(desc(estimates.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/portal/estimates" });
}
