import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cardTransactions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { matchCardTxnSchema } from "@/lib/validations";
import { matchCardTransaction } from "@/lib/services/expense-extended";

// POST /api/card-transactions/[id]/match — link a card txn to an expense
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [txn] = await db.select().from(cardTransactions).where(eq(cardTransactions.id, id)).limit(1);
    if (!txn) return notFound();
    if (!(await hasModuleAccess(txn.workspaceId, session.user.id, "canAccessExpenses", session.user.role))) return forbidden();
    const { expenseId } = matchCardTxnSchema.parse(await req.json());
    return ok(await matchCardTransaction(txn.workspaceId, id, expenseId));
  }, { route: "POST /api/card-transactions/[id]/match" });
}
