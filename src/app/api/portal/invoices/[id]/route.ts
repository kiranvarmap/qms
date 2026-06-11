import { db } from "@/lib/db";
import { invoiceLineItems } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound } from "@/lib/api";
import { getPortalSession } from "@/lib/services/portal-auth";
import { loadScopedInvoice } from "@/lib/services/portal-data";

// GET /api/portal/invoices/[id] — invoice detail (customer-scoped, read-only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const s = await getPortalSession();
    if (!s) return unauthorized();
    const { id } = await params;

    const inv = await loadScopedInvoice(id, s);
    if (!inv) return notFound();

    const lines = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id))
      .orderBy(asc(invoiceLineItems.position));

    return ok({ ...inv, lines });
  }, { route: "GET /api/portal/invoices/[id]" });
}
