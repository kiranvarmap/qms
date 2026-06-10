import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, stockLevels, warehouses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateProductSchema } from "@/lib/validations";
import { toMinor } from "@/lib/money";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

async function load(id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return product ?? null;
}

// GET /api/products/[id] — product with per-warehouse stock levels
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const product = await load(id);
    if (!product) return notFound();
    if (!(await hasModuleAccess(product.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const levels = await db
      .select({
        warehouseId: stockLevels.warehouseId,
        warehouseName: warehouses.name,
        onHand: stockLevels.onHand,
        committed: stockLevels.committed,
      })
      .from(stockLevels)
      .leftJoin(warehouses, eq(warehouses.id, stockLevels.warehouseId))
      .where(eq(stockLevels.productId, id));

    return ok({ ...product, levels: levels.map((l) => ({ ...l, available: l.onHand - l.committed })) });
  }, { route: "GET /api/products/[id]" });
}

// PATCH /api/products/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const product = await load(id);
    if (!product) return notFound();
    if (!(await hasModuleAccess(product.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const patch = updateProductSchema.parse(await req.json());
    const [updated] = await db
      .update(products)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.sku !== undefined ? { sku: patch.sku || null } : {}),
        ...(patch.type !== undefined ? { type: patch.type } : {}),
        ...(patch.category !== undefined ? { category: patch.category || null } : {}),
        ...(patch.unit !== undefined ? { unit: patch.unit || "unit" } : {}),
        ...(patch.description !== undefined ? { description: patch.description || null } : {}),
        ...(patch.cost !== undefined ? { costMinor: toMinor(patch.cost) } : {}),
        ...(patch.price !== undefined ? { priceMinor: toMinor(patch.price) } : {}),
        ...(patch.reorderLevel !== undefined ? { reorderLevel: patch.reorderLevel } : {}),
        ...(patch.trackInventory !== undefined ? { trackInventory: patch.trackInventory } : {}),
        ...(patch.lifecycleStatus !== undefined ? { lifecycleStatus: patch.lifecycleStatus } : {}),
        ...(patch.boardId !== undefined ? { boardId: patch.boardId || null } : {}),
        ...(patch.qcRequired !== undefined ? { qcRequired: patch.qcRequired } : {}),
        ...(patch.qcTemplateId !== undefined ? { qcTemplateId: patch.qcTemplateId || null } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        updatedAt: new Date(),
      })
      .where(eq(products.id, id))
      .returning();

    const lifecycleChanged =
      patch.lifecycleStatus !== undefined && patch.lifecycleStatus !== product.lifecycleStatus;
    await emitEvent(db, {
      workspaceId: product.workspaceId,
      eventType: lifecycleChanged ? "product.lifecycle_changed" : "product.updated",
      aggregateType: "product",
      aggregateId: id,
      actorUserId: session.user.id,
      payload: lifecycleChanged
        ? { sku: updated.sku, name: updated.name, from: product.lifecycleStatus, to: updated.lifecycleStatus }
        : { sku: updated.sku, name: updated.name },
    });
    dispatchInline();

    return ok(updated);
  }, { route: "PATCH /api/products/[id]" });
}

// DELETE /api/products/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const product = await load(id);
    if (!product) return notFound();
    if (!(await hasModuleAccess(product.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    await db.delete(products).where(eq(products.id, id));
    return noContent();
  }, { route: "DELETE /api/products/[id]" });
}
