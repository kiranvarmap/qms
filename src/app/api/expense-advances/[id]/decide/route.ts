import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { expenseAdvances } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { advanceDecisionSchema } from "@/lib/validations";
import { decideAdvance } from "@/lib/services/expense-extended";

// POST /api/expense-advances/[id]/decide — approve or settle a cash advance
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [adv] = await db.select().from(expenseAdvances).where(eq(expenseAdvances.id, id)).limit(1);
    if (!adv) return notFound();
    if (!(await hasModuleAccess(adv.workspaceId, session.user.id, "canAccessExpenses", session.user.role))) return forbidden();
    const { decision, settledAmount } = advanceDecisionSchema.parse(await req.json());
    return ok(await decideAdvance(adv.workspaceId, id, decision, settledAmount));
  }, { route: "POST /api/expense-advances/[id]/decide" });
}
