import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { sendDunning } from "@/lib/services/books";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/invoices/[id]/dunning — record + emit an overdue reminder (next level)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const row = await sendDunning(inv.workspaceId, id, session.user.id);
    dispatchInline();
    return created(row);
  }, { route: "POST /api/invoices/[id]/dunning" });
}
