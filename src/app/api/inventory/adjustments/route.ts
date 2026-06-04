import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, warehouses, stockLevels } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { stockAdjustmentSchema } from "@/lib/validations";
import { applyStockMovement } from "@/lib/services/inventory";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/inventory/adjustments — manual stock adjustment (signed quantity).
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = stockAdjustmentSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const [product] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
    if (!product || product.workspaceId !== input.workspaceId) return badRequest("Invalid product");
    if (!product.trackInventory) return badRequest("Product does not track inventory");

    const [warehouse] = await db.select().from(warehouses).where(eq(warehouses.id, input.warehouseId)).limit(1);
    if (!warehouse || warehouse.workspaceId !== input.workspaceId) return badRequest("Invalid warehouse");

    // Guard against driving on-hand negative.
    const [level] = await db
      .select({ onHand: stockLevels.onHand })
      .from(stockLevels)
      .where(and(eq(stockLevels.productId, input.productId), eq(stockLevels.warehouseId, input.warehouseId)))
      .limit(1);
    const current = level?.onHand ?? 0;
    if (current + input.quantity < 0) return badRequest("Adjustment would make on-hand negative");

    const result = await db.transaction((tx) =>
      applyStockMovement(tx, {
        workspaceId: input.workspaceId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        type: "adjustment",
        quantity: input.quantity,
        refType: "adjustment",
        note: input.note ?? null,
        actorUserId: session.user.id,
      })
    );

    dispatchInline();
    return ok({ ...result, available: result.onHand - result.committed });
  }, { route: "POST /api/inventory/adjustments" });
}
