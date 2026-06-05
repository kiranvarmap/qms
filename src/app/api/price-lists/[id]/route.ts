import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { priceLists } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { priceListItemSchema } from "@/lib/validations";
import { getPriceList, setPriceListItem } from "@/lib/services/sales-extended";

async function guard(id: string, userId: string, role?: string) {
  const [pl] = await db.select().from(priceLists).where(eq(priceLists.id, id)).limit(1);
  if (!pl) return { error: "not_found" as const };
  if (!(await hasModuleAccess(pl.workspaceId, userId, "canAccessInvoicing", role))) return { error: "forbidden" as const };
  return { workspaceId: pl.workspaceId };
}

// GET /api/price-lists/[id] — price list + items
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    return ok(await getPriceList(g.workspaceId, id));
  }, { route: "GET /api/price-lists/[id]" });
}

// POST /api/price-lists/[id] — upsert a product price into the list
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const input = priceListItemSchema.parse(await req.json());
    await setPriceListItem(id, input.productId, input.unitPrice);
    return created({ ok: true });
  }, { route: "POST /api/price-lists/[id]" });
}
