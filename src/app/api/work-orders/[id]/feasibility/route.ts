import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders, jobStageSchedules, planningConflicts } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { runPlanning } from "@/lib/services/planning-engine";

// GET /api/work-orders/[id]/feasibility — last persisted plan, or a fresh
// computed one if the job has never been planned. `?refresh=1` forces recompute.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (!wo) return notFound();
    if (!(await hasModuleAccess(wo.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();

    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    if (refresh || !wo.planningCheckedAt) {
      const result = await runPlanning(wo.workspaceId, id);
      return ok({ workOrder: wo, computed: result, persisted: false });
    }

    const stages = await db.select().from(jobStageSchedules).where(eq(jobStageSchedules.workOrderId, id)).orderBy(asc(jobStageSchedules.sequence));
    const conflicts = await db.select().from(planningConflicts).where(eq(planningConflicts.workOrderId, id));
    return ok({ workOrder: wo, stages, conflicts, persisted: true });
  }, { route: "GET /api/work-orders/[id]/feasibility" });
}
