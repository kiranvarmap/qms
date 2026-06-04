import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taxRates } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { updateTaxRateSchema } from "@/lib/validations";

async function load(id: string) {
  const [rate] = await db.select().from(taxRates).where(eq(taxRates.id, id)).limit(1);
  return rate ?? null;
}

// PATCH /api/tax-rates/[id] — update (workspace admin/owner only)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const rate = await load(id);
    if (!rate) return notFound();
    if (!(await canAdminWorkspace(rate.workspaceId, session.user.id, session.user.role))) return forbidden();

    const patch = updateTaxRateSchema.parse(await req.json());
    const [updated] = await db.transaction(async (tx) => {
      if (patch.isDefault) {
        await tx
          .update(taxRates)
          .set({ isDefault: false })
          .where(and(eq(taxRates.workspaceId, rate.workspaceId), eq(taxRates.isDefault, true)));
      }
      return tx
        .update(taxRates)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.rateBasisPoints !== undefined ? { rateBasisPoints: patch.rateBasisPoints } : {}),
          ...(patch.type !== undefined ? { type: patch.type } : {}),
          ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
          ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
          updatedAt: new Date(),
        })
        .where(eq(taxRates.id, id))
        .returning();
    });

    return ok(updated);
  }, { route: "PATCH /api/tax-rates/[id]" });
}

// DELETE /api/tax-rates/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const rate = await load(id);
    if (!rate) return notFound();
    if (!(await canAdminWorkspace(rate.workspaceId, session.user.id, session.user.role))) return forbidden();

    await db.delete(taxRates).where(eq(taxRates.id, id));
    return noContent();
  }, { route: "DELETE /api/tax-rates/[id]" });
}
