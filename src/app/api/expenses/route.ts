import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenses, employees, expenseCategories } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createExpenseSchema } from "@/lib/validations";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { resolveAndValidateScope, LinkPolicyError } from "@/lib/services/linking";
import { toMinor } from "@/lib/money";

// GET /api/expenses?workspaceId=...&status=&mine=true — list expenses
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessExpenses", session.user.role)))
      return forbidden();

    const status = url.searchParams.get("status");
    const conds = [eq(expenses.workspaceId, workspaceId)];
    if (status) conds.push(eq(expenses.status, status as typeof expenses.$inferSelect.status));
    if (url.searchParams.get("mine") === "true") {
      const [me] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.userId, session.user.id), eq(employees.workspaceId, workspaceId)))
        .limit(1);
      if (!me) return ok({ data: [] });
      conds.push(eq(expenses.employeeId, me.id));
    }

    const rows = await db
      .select({
        id: expenses.id,
        docNumber: expenses.docNumber,
        status: expenses.status,
        amountMinor: expenses.amountMinor,
        currency: expenses.currency,
        spentAt: expenses.spentAt,
        description: expenses.description,
        employeeName: employees.name,
        categoryName: expenseCategories.name,
      })
      .from(expenses)
      .leftJoin(employees, eq(employees.id, expenses.employeeId))
      .leftJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
      .where(and(...conds))
      .orderBy(desc(expenses.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/expenses" });
}

// POST /api/expenses — create a draft expense
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createExpenseSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessExpenses", session.user.role)))
      return forbidden();

    // Resolve the employee — explicit, or the caller's own employee record.
    let employeeId = input.employeeId;
    if (!employeeId) {
      const [me] = await db
        .select({ id: employees.id })
        .from(employees)
        .where(and(eq(employees.userId, session.user.id), eq(employees.workspaceId, input.workspaceId)))
        .limit(1);
      if (!me) return badRequest("No employee record for the current user; pass employeeId");
      employeeId = me.id;
    } else {
      const [emp] = await db.select().from(employees).where(eq(employees.id, employeeId)).limit(1);
      if (!emp || emp.workspaceId !== input.workspaceId) return badRequest("Invalid employee");
    }

    let scope;
    try {
      scope = await resolveAndValidateScope("expense", {
        workspaceId: input.workspaceId,
        boardId: input.boardId ?? null,
        groupId: input.groupId ?? null,
        itemId: input.itemId ?? null,
      });
    } catch (err) {
      if (err instanceof LinkPolicyError) return badRequest(err.message);
      throw err;
    }

    // Mileage expenses derive their amount from distance × rate.
    const mileageRateMinor = input.mileageRate !== undefined ? toMinor(input.mileageRate) : 0;
    const amountMinor = input.kind === "mileage"
      ? Math.round((input.mileageDistance ?? 0) * mileageRateMinor)
      : toMinor(input.amount ?? 0);
    if (amountMinor <= 0) return badRequest("Amount must be greater than 0 (or provide mileage distance × rate)");

    const expense = await db.transaction(async (tx) => {
      const docNumber = await nextDocNumber(tx, { workspaceId: input.workspaceId, docType: "expense" });
      const [row] = await tx
        .insert(expenses)
        .values({
          workspaceId: input.workspaceId,
          docNumber,
          employeeId,
          categoryId: input.categoryId || null,
          vendorId: input.vendorId || null,
          amountMinor,
          spentAt: input.spentAt ? new Date(input.spentAt) : new Date(),
          description: input.description || null,
          receiptFilePath: input.receiptFilePath || null,
          status: "draft",
          kind: input.kind,
          mileageDistance: input.mileageDistance ?? 0,
          mileageRateMinor,
          costCentre: input.costCentre || null,
          billable: input.billable ?? false,
          customerId: input.customerId || null,
          boardId: scope.boardId,
          groupId: scope.groupId,
          itemId: scope.itemId,
          linkLevel: scope.linkLevel,
          createdBy: session.user.id,
        })
        .returning();
      return row;
    });

    return created(expense);
  }, { route: "POST /api/expenses" });
}
