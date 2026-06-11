import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { submitVendorForApproval } from "@/lib/services/vendor-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/vendors/[id]/submit — submit vendor onboarding for approval
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [v] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
    if (!v) return notFound();
    if (!(await hasModuleAccess(v.workspaceId, session.user.id, "canAccessVendors", session.user.role))) return forbidden();
    if (v.approvalState === "pending") return conflict("Already pending approval");
    const res = await submitVendorForApproval(v.workspaceId, id, session.user.id);
    dispatchInline();
    return ok(res);
  }, { route: "POST /api/vendors/[id]/submit" });
}
