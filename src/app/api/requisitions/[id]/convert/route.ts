import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { convertRequisitionToPo } from "@/lib/services/purchasing-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/requisitions/[id]/convert — turn an approved requisition into a draft PO
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [r] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, id)).limit(1);
    if (!r) return notFound();
    if (!(await hasModuleAccess(r.workspaceId, session.user.id, "canAccessPurchasing", session.user.role))) return forbidden();
    const res = await convertRequisitionToPo(r.workspaceId, id, session.user.id);
    if ("error" in res) {
      if (res.error === "not_found") return notFound();
      if (res.error === "conflict") return conflict("Only approved requisitions can be converted");
      if (res.error === "no_vendor") return badRequest("Requisition needs a vendor before converting");
    }
    dispatchInline();
    return ok(res);
  }, { route: "POST /api/requisitions/[id]/convert" });
}
