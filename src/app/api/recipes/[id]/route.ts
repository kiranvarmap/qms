import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventRecipes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(160).trim().optional(),
  isActive: z.boolean().optional(),
});

async function loadAndGate(id: string, userId: string, role: string) {
  const [recipe] = await db.select().from(eventRecipes).where(eq(eventRecipes.id, id)).limit(1);
  if (!recipe) return { recipe: null, allowed: false };
  const allowed = role === "admin" || (await canAdminWorkspace(recipe.workspaceId, userId));
  return { recipe, allowed };
}

// PATCH /api/recipes/[id] — rename / enable / disable
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const { recipe, allowed } = await loadAndGate(id, session.user.id, session.user.role);
    if (!recipe) return notFound();
    if (!allowed) return forbidden();

    const patch = patchSchema.parse(await req.json());
    const [updated] = await db
      .update(eventRecipes)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      })
      .where(eq(eventRecipes.id, id))
      .returning();
    return ok(updated);
  }, { route: "PATCH /api/recipes/[id]" });
}

// DELETE /api/recipes/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const { recipe, allowed } = await loadAndGate(id, session.user.id, session.user.role);
    if (!recipe) return notFound();
    if (!allowed) return forbidden();

    await db.delete(eventRecipes).where(eq(eventRecipes.id, id));
    return noContent();
  }, { route: "DELETE /api/recipes/[id]" });
}
