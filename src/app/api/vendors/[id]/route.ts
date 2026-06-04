import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateVendorSchema } from "@/lib/validations";

async function load(id: string) {
  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  return vendor ?? null;
}

// GET /api/vendors/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const vendor = await load(id);
    if (!vendor) return notFound();
    if (!(await hasModuleAccess(vendor.workspaceId, session.user.id, "canAccessVendors", session.user.role)))
      return forbidden();

    return ok(vendor);
  }, { route: "GET /api/vendors/[id]" });
}

// PATCH /api/vendors/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const vendor = await load(id);
    if (!vendor) return notFound();
    if (!(await hasModuleAccess(vendor.workspaceId, session.user.id, "canAccessVendors", session.user.role)))
      return forbidden();

    const patch = updateVendorSchema.parse(await req.json());
    const [updated] = await db
      .update(vendors)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.code !== undefined ? { code: patch.code || null } : {}),
        ...(patch.email !== undefined ? { email: patch.email || null } : {}),
        ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
        ...(patch.taxId !== undefined ? { taxId: patch.taxId || null } : {}),
        ...(patch.address !== undefined ? { address: patch.address } : {}),
        ...(patch.paymentTermsDays !== undefined ? { paymentTermsDays: patch.paymentTermsDays } : {}),
        ...(patch.accountManagerEmployeeId !== undefined
          ? { accountManagerEmployeeId: patch.accountManagerEmployeeId || null }
          : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, id))
      .returning();

    return ok(updated);
  }, { route: "PATCH /api/vendors/[id]" });
}

// DELETE /api/vendors/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const vendor = await load(id);
    if (!vendor) return notFound();
    if (!(await hasModuleAccess(vendor.workspaceId, session.user.id, "canAccessVendors", session.user.role)))
      return forbidden();

    await db.delete(vendors).where(eq(vendors.id, id));
    return noContent();
  }, { route: "DELETE /api/vendors/[id]" });
}
