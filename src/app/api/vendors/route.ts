import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createVendorSchema } from "@/lib/validations";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/vendors?workspaceId=...&status=active — list a workspace's vendors
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessVendors", session.user.role)))
      return forbidden();

    const status = url.searchParams.get("status");
    const where = status
      ? and(eq(vendors.workspaceId, workspaceId), eq(vendors.status, status as "active" | "inactive"))
      : eq(vendors.workspaceId, workspaceId);

    const rows = await db.select().from(vendors).where(where).orderBy(desc(vendors.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/vendors" });
}

// POST /api/vendors — create a vendor
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createVendorSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessVendors", session.user.role)))
      return forbidden();

    const [vendor] = await db
      .insert(vendors)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        code: input.code || null,
        email: input.email || null,
        phone: input.phone || null,
        taxId: input.taxId || null,
        address: input.address ?? {},
        paymentTermsDays: input.paymentTermsDays ?? 30,
        accountManagerEmployeeId: input.accountManagerEmployeeId || null,
        notes: input.notes || null,
        createdBy: session.user.id,
      })
      .returning();

    await emitEvent(db, {
      workspaceId: input.workspaceId,
      eventType: "vendor.created",
      aggregateType: "vendor",
      aggregateId: vendor.id,
      actorUserId: session.user.id,
      payload: { name: vendor.name },
    });
    dispatchInline();

    return created(vendor);
  }, { route: "POST /api/vendors" });
}
