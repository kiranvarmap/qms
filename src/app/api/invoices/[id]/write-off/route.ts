import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { writeOffSchema } from "@/lib/validations";
import { writeOffInvoice } from "@/lib/services/books";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/invoices/[id]/write-off — write off part/all of an invoice balance
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const { amount } = writeOffSchema.parse(await req.json());
    const updated = await writeOffInvoice(inv.workspaceId, id, amount, session.user.id);
    dispatchInline();
    return ok(updated);
  }, { route: "POST /api/invoices/[id]/write-off" });
}
