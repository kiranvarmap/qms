import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { simulateSchema } from "@/lib/validations";
import { runPlanning } from "@/lib/services/planning-engine";

// POST /api/work-orders/[id]/simulate — what-if: run the engine with overrides
// and return both the baseline and the scenario result. No DB writes.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (!wo) return notFound();
    if (!(await hasModuleAccess(wo.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();

    const overrides = simulateSchema.parse(await req.json());
    const [baseline, scenario] = await Promise.all([
      runPlanning(wo.workspaceId, id),
      runPlanning(wo.workspaceId, id, overrides),
    ]);
    return ok({ baseline, scenario });
  }, { route: "POST /api/work-orders/[id]/simulate" });
}
