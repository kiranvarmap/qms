import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditNotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { applyCreditNote } from "@/lib/services/books";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/credit-notes/[id]/apply — apply to the linked invoice (reduces balance)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [cn] = await db.select().from(creditNotes).where(eq(creditNotes.id, id)).limit(1);
    if (!cn) return notFound();
    if (!(await hasModuleAccess(cn.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const res = await applyCreditNote(cn.workspaceId, id, session.user.id);
    if ("error" in res) {
      if (res.error === "not_found") return notFound();
      if (res.error === "conflict") return conflict("Credit note already applied");
      if (res.error === "no_invoice") return badRequest("Credit note has no linked invoice");
    }
    dispatchInline();
    return ok(res);
  }, { route: "POST /api/credit-notes/[id]/apply" });
}
