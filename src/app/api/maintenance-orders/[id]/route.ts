import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { maintenanceOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { getMaintenanceOrder } from "@/lib/services/maintenance";

// GET /api/maintenance-orders/[id] — order with its parts
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [mo] = await db.select().from(maintenanceOrders).where(eq(maintenanceOrders.id, id)).limit(1);
    if (!mo) return notFound();
    if (!(await hasModuleAccess(mo.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    return ok(await getMaintenanceOrder(mo.workspaceId, id));
  }, { route: "GET /api/maintenance-orders/[id]" });
}
