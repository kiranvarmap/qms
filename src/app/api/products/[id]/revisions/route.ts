import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createRevisionSchema } from "@/lib/validations";
import { createRevision } from "@/lib/services/product";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/products/[id]/revisions — create (optionally release) a revision
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return notFound();
    if (!(await hasModuleAccess(product.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const input = createRevisionSchema.parse(await req.json());
    const rev = await createRevision(product.workspaceId, id, input, session.user.id);
    dispatchInline();
    return created(rev);
  }, { route: "POST /api/products/[id]/revisions" });
}
