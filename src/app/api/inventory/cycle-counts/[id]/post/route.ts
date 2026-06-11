import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cycleCounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { postCycleCount } from "@/lib/services/inventory-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/inventory/cycle-counts/[id]/post — apply variances as stock adjustments
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [cc] = await db.select().from(cycleCounts).where(eq(cycleCounts.id, id)).limit(1);
    if (!cc) return notFound();
    if (!(await hasModuleAccess(cc.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const res = await postCycleCount(cc.workspaceId, id, cc.warehouseId, session.user.id);
    if ("error" in res) {
      if (res.error === "not_found") return notFound();
      if (res.error === "conflict") return conflict("Cycle count already posted");
    }
    dispatchInline();
    return ok(res);
  }, { route: "POST /api/inventory/cycle-counts/[id]/post" });
}
