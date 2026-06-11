import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenses, employees, expenseCategories, vendors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateExpenseSchema } from "@/lib/validations";
import { toMinor } from "@/lib/money";

async function load(id: string) {
  const [exp] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
  return exp ?? null;
}

// GET /api/expenses/[id] — expense with employee / category / vendor names
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const exp = await load(id);
    if (!exp) return notFound();
    if (!(await hasModuleAccess(exp.workspaceId, session.user.id, "canAccessExpenses", session.user.role)))
      return forbidden();

    const [[employee], [category], [vendor]] = await Promise.all([
      db.select({ name: employees.name }).from(employees).where(eq(employees.id, exp.employeeId)).limit(1),
      exp.categoryId ? db.select({ name: expenseCategories.name }).from(expenseCategories).where(eq(expenseCategories.id, exp.categoryId)).limit(1) : Promise.resolve([undefined]),
      exp.vendorId ? db.select({ name: vendors.name }).from(vendors).where(eq(vendors.id, exp.vendorId)).limit(1) : Promise.resolve([undefined]),
    ]);

    return ok({ ...exp, employeeName: employee?.name ?? null, categoryName: category?.name ?? null, vendorName: vendor?.name ?? null });
  }, { route: "GET /api/expenses/[id]" });
}

// PATCH /api/expenses/[id] — edit a draft expense only
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const exp = await load(id);
    if (!exp) return notFound();
    if (!(await hasModuleAccess(exp.workspaceId, session.user.id, "canAccessExpenses", session.user.role)))
      return forbidden();
    if (exp.status !== "draft") return conflict("Only draft expenses can be edited");

    const patch = updateExpenseSchema.parse(await req.json());
    const [updated] = await db
      .update(expenses)
      .set({
        ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
        ...(patch.vendorId !== undefined ? { vendorId: patch.vendorId } : {}),
        ...(patch.amount !== undefined ? { amountMinor: toMinor(patch.amount) } : {}),
        ...(patch.spentAt !== undefined ? { spentAt: new Date(patch.spentAt) } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.receiptFilePath !== undefined ? { receiptFilePath: patch.receiptFilePath } : {}),
        updatedAt: new Date(),
      })
      .where(eq(expenses.id, id))
      .returning();
    return ok(updated);
  }, { route: "PATCH /api/expenses/[id]" });
}

// DELETE /api/expenses/[id] — draft / rejected only
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const exp = await load(id);
    if (!exp) return notFound();
    if (!(await hasModuleAccess(exp.workspaceId, session.user.id, "canAccessExpenses", session.user.role)))
      return forbidden();
    if (exp.status !== "draft" && exp.status !== "rejected")
      return conflict("Only draft or rejected expenses can be deleted");

    await db.delete(expenses).where(eq(expenses.id, id));
    return noContent();
  }, { route: "DELETE /api/expenses/[id]" });
}
