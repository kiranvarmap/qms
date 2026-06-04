import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { products, stockMovements, warehouses } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";

// GET /api/products/[id]/movements — the immutable stock ledger for a product
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!product) return notFound();
    if (!(await hasModuleAccess(product.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const rows = await db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        onHandDelta: stockMovements.onHandDelta,
        committedDelta: stockMovements.committedDelta,
        warehouseId: stockMovements.warehouseId,
        warehouseName: warehouses.name,
        refType: stockMovements.refType,
        refId: stockMovements.refId,
        note: stockMovements.note,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .leftJoin(warehouses, eq(warehouses.id, stockMovements.warehouseId))
      .where(eq(stockMovements.productId, id))
      .orderBy(desc(stockMovements.createdAt))
      .limit(200);

    return ok({ data: rows });
  }, { route: "GET /api/products/[id]/movements" });
}
