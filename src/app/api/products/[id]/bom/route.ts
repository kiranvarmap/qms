import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createBomSchema } from "@/lib/validations";
import { createBom } from "@/lib/services/product";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/products/[id]/bom — create a bill of materials for the product
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return notFound();
    if (!(await hasModuleAccess(product.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const input = createBomSchema.parse(await req.json());
    const bom = await createBom(product.workspaceId, id, input, session.user.id);
    dispatchInline();
    return created(bom);
  }, { route: "POST /api/products/[id]/bom" });
}
