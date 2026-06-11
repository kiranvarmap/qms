import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { planAndPersist } from "@/lib/services/planning-engine";

// POST /api/work-orders/[id]/plan — run the planning engine and persist the result.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (!wo) return notFound();
    if (!(await hasModuleAccess(wo.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const result = await planAndPersist(wo.workspaceId, id, session.user.id);
    if (!result) return notFound();
    return ok(result);
  }, { route: "POST /api/work-orders/[id]/plan" });
}
