import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvalRequests, approvalSteps, employees } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, badRequest, forbidden } from "@/lib/api";
import { getMembership } from "@/lib/services/access";

// GET /api/approvals?workspaceId=...&mine=true&subjectType=&subjectId=&status=
// Lists approval requests. `mine=true` returns only requests currently awaiting
// the caller's decision (they are the current step's approver).
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (session.user.role !== "admin" && !(await getMembership(workspaceId, session.user.id)))
      return forbidden();

    const subjectType = url.searchParams.get("subjectType");
    const subjectId = url.searchParams.get("subjectId");
    const status = url.searchParams.get("status") as "pending" | "approved" | "rejected" | "cancelled" | null;
    const mine = url.searchParams.get("mine") === "true";

    const conds = [eq(approvalRequests.workspaceId, workspaceId)];
    if (subjectType) conds.push(eq(approvalRequests.subjectType, subjectType));
    if (subjectId) conds.push(eq(approvalRequests.subjectId, subjectId));
    if (status) conds.push(eq(approvalRequests.status, status));

    if (mine) {
      const [me] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.userId, session.user.id), eq(employees.workspaceId, workspaceId)))
        .limit(1);
      if (!me) return ok({ data: [] });

      const rows = await db
        .select({ request: approvalRequests })
        .from(approvalRequests)
        .innerJoin(
          approvalSteps,
          and(
            eq(approvalSteps.requestId, approvalRequests.id),
            eq(approvalSteps.stepNumber, approvalRequests.currentStep),
            eq(approvalSteps.approverEmployeeId, me.id)
          )
        )
        .where(and(...conds, eq(approvalRequests.status, "pending")))
        .orderBy(desc(approvalRequests.createdAt));
      return ok({ data: rows.map((r) => r.request) });
    }

    const rows = await db
      .select()
      .from(approvalRequests)
      .where(and(...conds))
      .orderBy(desc(approvalRequests.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/approvals" });
}
