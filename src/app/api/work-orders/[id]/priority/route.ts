import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { setPrioritySchema } from "@/lib/validations";
import { priorityImpact } from "@/lib/services/planning-engine";

// POST /api/work-orders/[id]/priority — preview impact (confirm:false) or apply
// the new priority (confirm:true). Impact = which other jobs share work centers.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (!wo) return notFound();
    if (!(await hasModuleAccess(wo.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();

    const { priority, confirm } = setPrioritySchema.parse(await req.json());
    const impact = await priorityImpact(wo.workspaceId, id);
    if (!confirm) return ok({ preview: true, priority, ...impact });

    const [updated] = await db
      .update(workOrders)
      .set({ priority, updatedAt: new Date() })
      .where(eq(workOrders.id, id))
      .returning();
    return ok({ applied: true, workOrder: updated, ...impact });
  }, { route: "POST /api/work-orders/[id]/priority" });
}
