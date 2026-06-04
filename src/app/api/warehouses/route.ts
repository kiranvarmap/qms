import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { warehouses } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createWarehouseSchema } from "@/lib/validations";

// GET /api/warehouses?workspaceId=... — list a workspace's warehouses
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const rows = await db
      .select()
      .from(warehouses)
      .where(eq(warehouses.workspaceId, workspaceId))
      .orderBy(desc(warehouses.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/warehouses" });
}

// POST /api/warehouses — create a warehouse
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createWarehouseSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const [warehouse] = await db.transaction(async (tx) => {
      if (input.isDefault) {
        await tx
          .update(warehouses)
          .set({ isDefault: false })
          .where(and(eq(warehouses.workspaceId, input.workspaceId), eq(warehouses.isDefault, true)));
      }
      return tx
        .insert(warehouses)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          code: input.code || null,
          location: input.location || null,
          workshopId: input.workshopId || null,
          isDefault: input.isDefault ?? false,
        })
        .returning();
    });

    return created(warehouse);
  }, { route: "POST /api/warehouses" });
}
