import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { purchaseOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { landedCostSchema } from "@/lib/validations";
import { listLandedCosts, addLandedCost } from "@/lib/services/purchasing-extended";

async function guard(id: string, userId: string, role?: string) {
  const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
  if (!po) return { error: "not_found" as const };
  if (!(await hasModuleAccess(po.workspaceId, userId, "canAccessPurchasing", role))) return { error: "forbidden" as const };
  return { workspaceId: po.workspaceId };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    return ok({ data: await listLandedCosts(g.workspaceId, id) });
  }, { route: "GET /api/purchase-orders/[id]/landed-costs" });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const input = landedCostSchema.parse(await req.json());
    return created(await addLandedCost(g.workspaceId, id, input));
  }, { route: "POST /api/purchase-orders/[id]/landed-costs" });
}
