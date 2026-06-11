import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { maintenanceOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { startMaintenance } from "@/lib/services/maintenance";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/maintenance-orders/[id]/start — begin the repair (asset → maintenance)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [mo] = await db.select().from(maintenanceOrders).where(eq(maintenanceOrders.id, id)).limit(1);
    if (!mo) return notFound();
    if (!(await hasModuleAccess(mo.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    if (mo.status !== "open" && mo.status !== "on_hold") return conflict("Only open orders can be started");
    const updated = await startMaintenance(mo.workspaceId, id, session.user.id);
    dispatchInline();
    return ok(updated);
  }, { route: "POST /api/maintenance-orders/[id]/start" });
}
