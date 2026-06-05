import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, created, noContent, unauthorized, notFound, forbidden, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { upsertSpecSchema } from "@/lib/validations";
import { addSpec, deleteSpec } from "@/lib/services/product";

async function guard(id: string, userId: string, role?: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return { error: "not_found" as const };
  if (!(await hasModuleAccess(product.workspaceId, userId, "canAccessInventory", role)))
    return { error: "forbidden" as const };
  return { workspaceId: product.workspaceId };
}

// POST /api/products/[id]/specs — add a specification (key/value/unit)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();

    const input = upsertSpecSchema.parse(await req.json());
    return created(await addSpec(g.workspaceId, id, input));
  }, { route: "POST /api/products/[id]/specs" });
}

// DELETE /api/products/[id]/specs?specId=... — remove a specification
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();

    const specId = new URL(req.url).searchParams.get("specId");
    if (!specId) return badRequest("specId required");
    await deleteSpec(g.workspaceId, specId);
    return noContent();
  }, { route: "DELETE /api/products/[id]/specs" });
}
