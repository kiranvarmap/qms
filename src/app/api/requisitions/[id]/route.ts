import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { getRequisition } from "@/lib/services/purchasing-extended";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [r] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, id)).limit(1);
    if (!r) return notFound();
    if (!(await hasModuleAccess(r.workspaceId, session.user.id, "canAccessPurchasing", session.user.role))) return forbidden();
    return ok(await getRequisition(r.workspaceId, id));
  }, { route: "GET /api/requisitions/[id]" });
}
