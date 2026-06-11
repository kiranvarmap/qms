import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenseCategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { expensePolicySchema } from "@/lib/validations";
import { setCategoryPolicy } from "@/lib/services/expense-extended";

// POST /api/expense-categories/[id]/policy — set the category's spend/receipt policy
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [cat] = await db.select().from(expenseCategories).where(eq(expenseCategories.id, id)).limit(1);
    if (!cat) return notFound();
    if (!(await hasModuleAccess(cat.workspaceId, session.user.id, "canAccessExpenses", session.user.role))) return forbidden();
    const input = expensePolicySchema.parse(await req.json());
    return ok(await setCategoryPolicy(cat.workspaceId, id, input.maxAmount, input.receiptRequiredAbove));
  }, { route: "POST /api/expense-categories/[id]/policy" });
}
