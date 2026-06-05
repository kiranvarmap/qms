import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { getVendorDetail } from "@/lib/services/vendor-extended";

// GET /api/vendors/[id]/detail — vendor + addresses, documents, bank, performance, items
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [v] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!v) return notFound();
    if (!(await hasModuleAccess(v.workspaceId, session.user.id, "canAccessVendors", session.user.role))) return forbidden();
    return ok(await getVendorDetail(v.workspaceId, id));
  }, { route: "GET /api/vendors/[id]/detail" });
}
