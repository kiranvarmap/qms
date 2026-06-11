import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { completeWorkOrderSchema } from "@/lib/validations";
import { completeWorkOrder } from "@/lib/services/production";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/work-orders/[id]/complete — consume components, receive finished goods
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [wo] = await db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    if (!wo) return notFound();
    if (!(await hasModuleAccess(wo.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const input = completeWorkOrderSchema.parse(await req.json());
    const result = await completeWorkOrder(wo.workspaceId, id, input, session.user.id);
    if ("error" in result) {
      if (result.error === "not_found") return notFound();
      if (result.error === "conflict") return conflict("Work order is already completed or cancelled");
      if (result.error === "no_warehouse") return badRequest("No warehouse available; create one first");
    }
    dispatchInline();
    return ok(result);
  }, { route: "POST /api/work-orders/[id]/complete" });
}
