import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, stockLevels } from "@/lib/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createProductSchema } from "@/lib/validations";
import { toMinor } from "@/lib/money";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/products?workspaceId=...&active=true — list with rolled-up stock
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const conds = [eq(products.workspaceId, workspaceId)];
    if (url.searchParams.get("active") === "true") conds.push(eq(products.isActive, true));

    const rows = await db
      .select({
        id: products.id,
        sku: products.sku,
        name: products.name,
        type: products.type,
        category: products.category,
        unit: products.unit,
        costMinor: products.costMinor,
        priceMinor: products.priceMinor,
        reorderLevel: products.reorderLevel,
        trackInventory: products.trackInventory,
        isActive: products.isActive,
        onHand: sql<number>`coalesce(sum(${stockLevels.onHand}), 0)`,
        committed: sql<number>`coalesce(sum(${stockLevels.committed}), 0)`,
      })
      .from(products)
      .leftJoin(stockLevels, eq(stockLevels.productId, products.id))
      .where(and(...conds))
      .groupBy(products.id)
      .orderBy(desc(products.createdAt));

    const data = rows.map((r) => ({ ...r, available: Number(r.onHand) - Number(r.committed) }));
    return ok({ data });
  }, { route: "GET /api/products" });
}

// POST /api/products — create a product
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createProductSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const [product] = await db
      .insert(products)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        sku: input.sku || null,
        type: input.type,
        category: input.category || null,
        unit: input.unit || "unit",
        description: input.description || null,
        costMinor: input.cost !== undefined ? toMinor(input.cost) : 0,
        priceMinor: input.price !== undefined ? toMinor(input.price) : 0,
        reorderLevel: input.reorderLevel ?? 0,
        // Services never carry stock.
        trackInventory: input.type === "service" ? false : input.trackInventory ?? true,
        lifecycleStatus: input.lifecycleStatus ?? "active",
        boardId: input.boardId || null,
        createdBy: session.user.id,
      })
      .returning();

    await emitEvent(db, {
      workspaceId: input.workspaceId,
      eventType: "product.created",
      aggregateType: "product",
      aggregateId: product.id,
      actorUserId: session.user.id,
      payload: { sku: product.sku, name: product.name },
    });
    dispatchInline();

    return created(product);
  }, { route: "POST /api/products" });
}
