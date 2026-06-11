import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { reimburseExpenseSchema } from "@/lib/validations";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/expenses/[id]/reimburse — record a MANUAL/offline reimbursement.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [exp] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
    if (!exp) return notFound();
    if (!(await hasModuleAccess(exp.workspaceId, session.user.id, "canAccessExpenses", session.user.role)))
      return forbidden();
    if (exp.status !== "approved") return conflict("Only approved expenses can be reimbursed");

    const input = reimburseExpenseSchema.parse(await req.json());

    await db.transaction(async (tx) => {
      await tx
        .update(expenses)
        .set({
          status: "reimbursed",
          reimbursedAt: new Date(),
          reimburseMethod: input.method,
          reimburseReference: input.reference || null,
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, id));
      await emitEvent(tx, {
        workspaceId: exp.workspaceId,
        eventType: "expense.reimbursed",
        aggregateType: "expense",
        aggregateId: exp.id,
        actorUserId: session.user.id,
        payload: { docNumber: exp.docNumber, employeeId: exp.employeeId, amountMinor: exp.amountMinor },
      });
    });

    dispatchInline();
    return ok({ id, status: "reimbursed" });
  }, { route: "POST /api/expenses/[id]/reimburse" });
}
