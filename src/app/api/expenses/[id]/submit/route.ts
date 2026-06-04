import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createApprovalRequest } from "@/lib/services/approvals";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/expenses/[id]/submit — send a draft expense into approval.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [exp] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!exp) return notFound();
    if (!(await hasModuleAccess(exp.workspaceId, session.user.id, "canAccessExpenses", session.user.role)))
      return forbidden();
    if (exp.status !== "draft") return conflict("Only draft expenses can be submitted");

    await db.transaction(async (tx) => {
      await tx.update(expenses).set({ status: "submitted", updatedAt: new Date() }).where(eq(expenses.id, id));
      await createApprovalRequest(tx, {
        workspaceId: exp.workspaceId,
        subjectType: "expense",
        subjectId: exp.id,
        requestedBy: session.user.id,
        amountMinor: exp.amountMinor,
        boardId: exp.boardId,
        itemId: exp.itemId,
      });
      await emitEvent(tx, {
        workspaceId: exp.workspaceId,
        eventType: "expense.submitted",
        aggregateType: "expense",
        aggregateId: exp.id,
        actorUserId: session.user.id,
        payload: { docNumber: exp.docNumber, employeeId: exp.employeeId, boardId: exp.boardId, itemId: exp.itemId },
      });
    });

    dispatchInline();
    return ok({ id, status: "submitted" });
  }, { route: "POST /api/expenses/[id]/submit" });
}
