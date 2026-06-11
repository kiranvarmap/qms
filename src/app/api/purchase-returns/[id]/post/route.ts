import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseReturns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { postReturn } from "@/lib/services/purchasing-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/purchase-returns/[id]/post — relieve stock + emit po.returned
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [r] = await db.select().from(purchaseReturns).where(eq(purchaseReturns.id, id)).limit(1);
    if (!r) return notFound();
    if (!(await hasModuleAccess(r.workspaceId, session.user.id, "canAccessPurchasing", session.user.role))) return forbidden();
    const res = await postReturn(r.workspaceId, id, session.user.id);
    if ("error" in res) {
      if (res.error === "not_found") return notFound();
      if (res.error === "conflict") return conflict("Return already posted or cancelled");
      if (res.error === "no_warehouse") return badRequest("Return needs a warehouse to relieve stock from");
    }
    dispatchInline();
    return ok(res);
  }, { route: "POST /api/purchase-returns/[id]/post" });
}
