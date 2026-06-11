import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenseCategories } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createExpenseCategorySchema } from "@/lib/validations";

// GET /api/expense-categories?workspaceId=... — list categories
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessExpenses", session.user.role)))
      return forbidden();

    const rows = await db
      .select()
      .from(expenseCategories)
      .where(eq(expenseCategories.workspaceId, workspaceId))
      .orderBy(asc(expenseCategories.name));
    return ok({ data: rows });
  }, { route: "GET /api/expense-categories" });
}

// POST /api/expense-categories — create a category
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createExpenseCategorySchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessExpenses", session.user.role)))
      return forbidden();

    try {
      const [row] = await db
        .insert(expenseCategories)
        .values({ workspaceId: input.workspaceId, name: input.name })
        .returning();
      return created(row);
    } catch {
      return conflict("A category with this name already exists");
    }
  }, { route: "POST /api/expense-categories" });
}
