import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { releaseWorkOrder } from "@/lib/services/production";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/work-orders/[id]/release — release a planned work order to the floor
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (!wo) return notFound();
    if (!(await hasModuleAccess(wo.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    if (wo.status !== "planned") return conflict("Only planned work orders can be released");

    const updated = await releaseWorkOrder(wo.workspaceId, id, session.user.id);
    dispatchInline();
    return ok(updated);
  }, { route: "POST /api/work-orders/[id]/release" });
}
