import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cycleCounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { enterCountsSchema } from "@/lib/validations";
import { getCycleCount, enterCounts } from "@/lib/services/inventory-extended";

async function guard(id: string, userId: string, role?: string) {
  const [cc] = await db.select().from(cycleCounts).where(eq(cycleCounts.id, id)).limit(1);
  if (!cc) return { error: "not_found" as const };
  if (!(await hasModuleAccess(cc.workspaceId, userId, "canAccessInventory", role))) return { error: "forbidden" as const };
  return { workspaceId: cc.workspaceId };
}

// GET /api/inventory/cycle-counts/[id] — count with lines
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    return ok(await getCycleCount(g.workspaceId, id));
  }, { route: "GET /api/inventory/cycle-counts/[id]" });
}

// PATCH /api/inventory/cycle-counts/[id] — enter counted quantities
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const { counts } = enterCountsSchema.parse(await req.json());
    return ok(await enterCounts(g.workspaceId, id, counts));
  }, { route: "PATCH /api/inventory/cycle-counts/[id]" });
}
