import { db } from "@/lib/db";
import { estimates, estimateLineItems } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound } from "@/lib/api";
import { getPortalSession } from "@/lib/services/portal-auth";
import { loadScopedEstimate } from "@/lib/services/portal-data";

// GET /api/portal/estimates/[id] — detail (customer-scoped, default-deny).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const s = await getPortalSession();
    if (!s) return unauthorized();
    const { id } = await params;

    const est = await loadScopedEstimate(id, s);
    if (!est) return notFound();

    // First view stamps `viewed` so staff see engagement.
    if (est.status === "sent") {
      await db.update(estimates).set({ status: "viewed", updatedAt: new Date() }).where(eq(estimates.id, id));
      est.status = "viewed";
    }

    const lines = await db
      .select()
      .from(estimateLineItems)
      .where(eq(estimateLineItems.estimateId, id))
      .orderBy(asc(estimateLineItems.position));

    return ok({ ...est, lines });
  }, { route: "GET /api/portal/estimates/[id]" });
}
