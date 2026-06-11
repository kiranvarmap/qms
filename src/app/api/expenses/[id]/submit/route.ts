import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenses, expenseCategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createApprovalRequest } from "@/lib/services/approvals";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

/** Category policy check (full BRD): spend limit + receipt-required threshold. */
async function policyViolated(categoryId: string | null, amountMinor: number, hasReceipt: boolean): Promise<boolean> {
  if (!categoryId) return false;
  const [cat] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, categoryId)).limit(1);
  if (!cat) return false;
  if (cat.maxAmountMinor > 0 && amountMinor > cat.maxAmountMinor) return true;
  if (cat.receiptRequiredAboveMinor > 0 && amountMinor > cat.receiptRequiredAboveMinor && !hasReceipt) return true;
  return false;
}

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

    const violation = await policyViolated(exp.categoryId, exp.amountMinor, Boolean(exp.receiptFilePath));

    await db.transaction(async (tx) => {
      await tx.update(expenses).set({ status: "submitted", policyViolation: violation, updatedAt: new Date() }).where(eq(expenses.id, id));
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
