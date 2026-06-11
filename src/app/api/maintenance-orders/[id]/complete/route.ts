import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { maintenanceOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { completeMaintenanceSchema } from "@/lib/validations";
import { completeMaintenance } from "@/lib/services/maintenance";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/maintenance-orders/[id]/complete — consume spares, asset → up
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [mo] = await db.select().from(maintenanceOrders).where(eq(maintenanceOrders.id, id)).limit(1);
    if (!mo) return notFound();
    if (!(await hasModuleAccess(mo.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    const input = completeMaintenanceSchema.parse(await req.json());
    const result = await completeMaintenance(mo.workspaceId, id, input, session.user.id);
    if ("error" in result) {
      if (result.error === "not_found") return notFound();
      if (result.error === "conflict") return conflict("Order already completed or cancelled");
    }
    dispatchInline();
    return ok(result);
  }, { route: "POST /api/maintenance-orders/[id]/complete" });
}
