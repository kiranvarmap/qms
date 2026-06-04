import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { warehouses } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateWarehouseSchema } from "@/lib/validations";

async function load(id: string) {
  const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, id)).limit(1);
  return warehouse ?? null;
}

// PATCH /api/warehouses/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const warehouse = await load(id);
    if (!warehouse) return notFound();
    if (!(await hasModuleAccess(warehouse.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const patch = updateWarehouseSchema.parse(await req.json());
    const [updated] = await db.transaction(async (tx) => {
      if (patch.isDefault) {
        await tx
          .update(warehouses)
          .set({ isDefault: false })
          .where(and(eq(warehouses.workspaceId, warehouse.workspaceId), eq(warehouses.isDefault, true)));
      }
      return tx
        .update(warehouses)
        .set({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.code !== undefined ? { code: patch.code || null } : {}),
          ...(patch.location !== undefined ? { location: patch.location || null } : {}),
          ...(patch.workshopId !== undefined ? { workshopId: patch.workshopId || null } : {}),
          ...(patch.isDefault !== undefined ? { isDefault: patch.isDefault } : {}),
          ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        })
        .where(eq(warehouses.id, id))
        .returning();
    });

    return ok(updated);
  }, { route: "PATCH /api/warehouses/[id]" });
}

// DELETE /api/warehouses/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const warehouse = await load(id);
    if (!warehouse) return notFound();
    if (!(await hasModuleAccess(warehouse.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    await db.delete(warehouses).where(eq(warehouses.id, id));
    return noContent();
  }, { route: "DELETE /api/warehouses/[id]" });
}
