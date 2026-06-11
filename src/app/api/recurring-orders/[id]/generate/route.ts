import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recurringOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { generateRecurringOrder } from "@/lib/services/sales-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/recurring-orders/[id]/generate — spawn a draft SO from the template
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [ro] = await db.select().from(recurringOrders).where(eq(recurringOrders.id, id)).limit(1);
    if (!ro) return notFound();
    if (!(await hasModuleAccess(ro.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const res = await generateRecurringOrder(ro.workspaceId, id, session.user.id);
    if ("error" in res) return notFound();
    dispatchInline();
    return ok(res);
  }, { route: "POST /api/recurring-orders/[id]/generate" });
}
