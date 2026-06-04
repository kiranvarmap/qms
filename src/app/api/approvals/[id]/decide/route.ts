import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvalRequests, approvalSteps, employees } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { approvalDecisionSchema } from "@/lib/validations";
import { recordApprovalDecision } from "@/lib/services/approvals";

// POST /api/approvals/[id]/decide — approve or reject the current step.
// Allowed for the current step's designated approver, or a workspace admin.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [request] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).limit(1);
    if (!request) return notFound();
    if (request.status !== "pending") return conflict("Approval request is already resolved");

    const { decision, comment } = approvalDecisionSchema.parse(await req.json());

    // Authorize: workspace admin, or the employee named on the current step.
    const isAdmin = await canAdminWorkspace(request.workspaceId, session.user.id, session.user.role);
    if (!isAdmin) {
      const [me] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.userId, session.user.id), eq(employees.workspaceId, request.workspaceId)))
        .limit(1);
      const [current] = await db
        .select({ approverEmployeeId: approvalSteps.approverEmployeeId })
        .from(approvalSteps)
        .where(and(eq(approvalSteps.requestId, id), eq(approvalSteps.stepNumber, request.currentStep)))
        .limit(1);
      if (!me || !current || current.approverEmployeeId !== me.id) return forbidden();
    }

    try {
      const result = await recordApprovalDecision({
        requestId: id,
        decision,
        decidedBy: session.user.id,
        comment: comment ?? null,
      });
      return ok(result);
    } catch (err) {
      return badRequest(err instanceof Error ? err.message : "Could not record decision");
    }
  }, { route: "POST /api/approvals/[id]/decide" });
}
