import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesReturns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { postSalesReturn } from "@/lib/services/sales-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/sales-returns/[id]/post — restock returned goods + emit salesreturn.posted
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [r] = await db.select().from(salesReturns).where(eq(salesReturns.id, id)).limit(1);
    if (!r) return notFound();
    if (!(await hasModuleAccess(r.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const res = await postSalesReturn(r.workspaceId, id, session.user.id);
    if ("error" in res) {
      if (res.error === "not_found") return notFound();
      if (res.error === "conflict") return conflict("Return already posted or cancelled");
      if (res.error === "no_warehouse") return badRequest("Set a warehouse to restock into (or disable restock)");
    }
    dispatchInline();
    return ok(res);
  }, { route: "POST /api/sales-returns/[id]/post" });
}
