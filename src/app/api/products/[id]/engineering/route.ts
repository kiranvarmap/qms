import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { getProductEngineering } from "@/lib/services/product";

// GET /api/products/[id]/engineering — BOMs, revisions, specs for a product
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return notFound();
    if (!(await hasModuleAccess(product.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    return ok(await getProductEngineering(product.workspaceId, id));
  }, { route: "GET /api/products/[id]/engineering" });
}
