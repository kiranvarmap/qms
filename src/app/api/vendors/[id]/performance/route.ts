import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { vendorPerformanceSchema } from "@/lib/validations";
import { addPerformance } from "@/lib/services/vendor-extended";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [v] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!v) return notFound();
    if (!(await hasModuleAccess(v.workspaceId, session.user.id, "canAccessVendors", session.user.role))) return forbidden();
    const input = vendorPerformanceSchema.parse(await req.json());
    return created(await addPerformance(v.workspaceId, id, input));
  }, { route: "POST /api/vendors/[id]/performance" });
}
