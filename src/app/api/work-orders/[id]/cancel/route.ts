import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { cancelWorkOrder } from "@/lib/services/production";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/work-orders/[id]/cancel — abandon a planned/released work order,
// releasing any material reservations it holds. Completed WOs cannot be
// cancelled (their stock movements already happened).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (!wo) return notFound();
    if (!(await hasModuleAccess(wo.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    if (wo.status !== "planned" && wo.status !== "released")
      return conflict("Only planned or released work orders can be cancelled");

    const updated = await cancelWorkOrder(wo.workspaceId, id, session.user.id);
    if (!updated) return conflict("Work order changed state; refresh and retry");

    dispatchInline();
    return ok(updated);
  }, { route: "POST /api/work-orders/[id]/cancel" });
}
