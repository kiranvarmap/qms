import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createLotSchema } from "@/lib/validations";
import { listLots, createLot } from "@/lib/services/inventory-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

async function guard(id: string, userId: string, role?: string) {
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!p) return { error: "not_found" as const };
  if (!(await hasModuleAccess(p.workspaceId, userId, "canAccessInventory", role))) return { error: "forbidden" as const };
  return { workspaceId: p.workspaceId };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    return ok({ data: await listLots(g.workspaceId, id) });
  }, { route: "GET /api/products/[id]/lots" });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const input = createLotSchema.parse(await req.json());
    const lot = await createLot(g.workspaceId, { ...input, productId: id }, session.user.id);
    dispatchInline();
    return created(lot);
  }, { route: "POST /api/products/[id]/lots" });
}
