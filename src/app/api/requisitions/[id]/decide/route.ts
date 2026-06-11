import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseRequisitions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { requisitionDecisionSchema } from "@/lib/validations";
import { decideRequisition } from "@/lib/services/purchasing-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [r] = await db.select().from(purchaseRequisitions).where(eq(purchaseRequisitions.id, id)).limit(1);
    if (!r) return notFound();
    if (!(await hasModuleAccess(r.workspaceId, session.user.id, "canAccessPurchasing", session.user.role))) return forbidden();
    if (r.status !== "submitted") return conflict("Only submitted requisitions can be decided");
    const { decision } = requisitionDecisionSchema.parse(await req.json());
    const updated = await decideRequisition(r.workspaceId, id, decision, session.user.id);
    dispatchInline();
    return ok(updated);
  }, { route: "POST /api/requisitions/[id]/decide" });
}
