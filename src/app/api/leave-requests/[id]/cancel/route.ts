import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { leaveRequests, approvalRequests } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { cancelApprovalRequest } from "@/lib/services/approvals";

// POST /api/leave-requests/[id]/cancel — withdraw a pending request.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [lr] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1);
    if (!lr) return notFound();
    if (!(await hasModuleAccess(lr.workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();
    if (lr.status !== "pending") return conflict("Only pending requests can be cancelled");

    // Cancel the linked approval, then mark the request cancelled.
    const [appr] = await db
      .select({ id: approvalRequests.id })
      .from(approvalRequests)
      .where(and(eq(approvalRequests.subjectType, "leave_request"), eq(approvalRequests.subjectId, id)))
      .limit(1);
    if (appr) await cancelApprovalRequest(appr.id, session.user.id);

    await db.update(leaveRequests).set({ status: "cancelled", updatedAt: new Date() }).where(eq(leaveRequests.id, id));
    return ok({ id, status: "cancelled" });
  }, { route: "POST /api/leave-requests/[id]/cancel" });
}
