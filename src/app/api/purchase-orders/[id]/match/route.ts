import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { threeWayMatch } from "@/lib/services/purchasing-extended";

// GET /api/purchase-orders/[id]/match — 3-way match summary (PO ↔ GRN)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
    if (!po) return notFound();
    if (!(await hasModuleAccess(po.workspaceId, session.user.id, "canAccessPurchasing", session.user.role))) return forbidden();
    return ok(await threeWayMatch(po.workspaceId, id));
  }, { route: "GET /api/purchase-orders/[id]/match" });
}
