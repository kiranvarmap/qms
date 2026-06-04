import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, warehouses, stockLevels } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { stockTransferSchema } from "@/lib/validations";
import { transferStock } from "@/lib/services/inventory";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/inventory/transfers — move stock between two warehouses.
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = stockTransferSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const [product] = await db.select().from(products).where(eq(products.id, input.productId)).limit(1);
    if (!product || product.workspaceId !== input.workspaceId) return badRequest("Invalid product");
    if (!product.trackInventory) return badRequest("Product does not track inventory");

    const whRows = await db
      .select()
      .from(warehouses)
      .where(inArray(warehouses.id, [input.fromWarehouseId, input.toWarehouseId]));
    if (whRows.length !== 2 || whRows.some((w) => w.workspaceId !== input.workspaceId))
      return badRequest("Invalid warehouse");

    // Source must have enough on-hand to transfer.
    const [src] = await db
      .select({ onHand: stockLevels.onHand })
      .from(stockLevels)
      .where(and(eq(stockLevels.productId, input.productId), eq(stockLevels.warehouseId, input.fromWarehouseId)))
      .limit(1);
    if ((src?.onHand ?? 0) < input.quantity) return badRequest("Insufficient stock at source warehouse");

    await db.transaction((tx) =>
      transferStock(tx, {
        workspaceId: input.workspaceId,
        productId: input.productId,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        quantity: input.quantity,
        note: input.note ?? null,
        actorUserId: session.user.id,
      })
    );

    dispatchInline();
    return ok({ transferred: input.quantity });
  }, { route: "POST /api/inventory/transfers" });
}
