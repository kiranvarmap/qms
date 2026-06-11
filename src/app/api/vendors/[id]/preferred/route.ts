import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { setPreferredSchema } from "@/lib/validations";
import { setPreferred } from "@/lib/services/vendor-extended";

// POST /api/vendors/[id]/preferred — toggle approved/preferred supplier flag
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [v] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!v) return notFound();
    if (!(await hasModuleAccess(v.workspaceId, session.user.id, "canAccessVendors", session.user.role))) return forbidden();
    const { isPreferred } = setPreferredSchema.parse(await req.json());
    return ok(await setPreferred(v.workspaceId, id, isPreferred));
  }, { route: "POST /api/vendors/[id]/preferred" });
}
