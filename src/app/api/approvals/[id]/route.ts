import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { approvalRequests, approvalSteps } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { getMembership } from "@/lib/services/access";

// GET /api/approvals/[id] — request with its ordered steps
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [request] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, id)).limit(1);
    if (!request) return notFound();
    if (session.user.role !== "admin" && !(await getMembership(request.workspaceId, session.user.id)))
      return forbidden();

    const steps = await db
      .select()
      .from(approvalSteps)
      .where(eq(approvalSteps.requestId, id))
      .orderBy(asc(approvalSteps.stepNumber));

    return ok({ ...request, steps });
  }, { route: "GET /api/approvals/[id]" });
}
