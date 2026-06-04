import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { taxRates } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { getMembership, canAdminWorkspace } from "@/lib/services/access";
import { createTaxRateSchema } from "@/lib/validations";

// GET /api/tax-rates?workspaceId=... — list a workspace's tax rates
// Readable by any member; the rates feed every finance module's line items.
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (session.user.role !== "admin" && !(await getMembership(workspaceId, session.user.id)))
      return forbidden();

    const rows = await db
      .select()
      .from(taxRates)
      .where(eq(taxRates.workspaceId, workspaceId))
      .orderBy(desc(taxRates.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/tax-rates" });
}

// POST /api/tax-rates — create a tax rate (workspace admin/owner only)
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createTaxRateSchema.parse(await req.json());
    if (!(await canAdminWorkspace(input.workspaceId, session.user.id, session.user.role)))
      return forbidden();

    const [rate] = await db.transaction(async (tx) => {
      // Only one default per workspace — clear the previous default if needed.
      if (input.isDefault) {
        await tx
          .update(taxRates)
          .set({ isDefault: false })
          .where(and(eq(taxRates.workspaceId, input.workspaceId), eq(taxRates.isDefault, true)));
      }
      return tx
        .insert(taxRates)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          rateBasisPoints: input.rateBasisPoints,
          type: input.type,
          isDefault: input.isDefault ?? false,
          isActive: input.isActive ?? true,
        })
        .returning();
    });

    return created(rate);
  }, { route: "POST /api/tax-rates" });
}
