import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { recurringInvoices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { generateRecurringInvoice } from "@/lib/services/books";
import { dispatchInline } from "@/lib/events/dispatcher";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [ri] = await db.select().from(recurringInvoices).where(eq(recurringInvoices.id, id)).limit(1);
    if (!ri) return notFound();
    if (!(await hasModuleAccess(ri.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const res = await generateRecurringInvoice(ri.workspaceId, id, session.user.id);
    if ("error" in res) return notFound();
    dispatchInline();
    return ok(res);
  }, { route: "POST /api/recurring-invoices/[id]/generate" });
}
