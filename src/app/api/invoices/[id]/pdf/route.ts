import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invoices, invoiceLineItems, customers, workspaces } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { renderDocumentPdf } from "@/lib/services/document-pdf";

export const dynamic = "force-dynamic";

// GET /api/invoices/[id]/pdf — downloadable invoice document (audit P5).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    if (!inv) return notFound();
    if (!(await hasModuleAccess(inv.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const [ws] = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, inv.workspaceId)).limit(1);
    const [customer] = inv.customerId
      ? await db.select({ name: customers.name }).from(customers).where(eq(customers.id, inv.customerId)).limit(1)
      : [];
    const lines = await db
      .select()
      .from(invoiceLineItems)
      .where(eq(invoiceLineItems.invoiceId, id))
      .orderBy(asc(invoiceLineItems.position));

    const bytes = await renderDocumentPdf({
      docType: inv.kind === "ap" ? "BILL" : "INVOICE",
      docNumber: inv.docNumber,
      status: inv.status,
      companyName: ws?.name ?? "Workspace",
      partyLabel: inv.kind === "ap" ? "Vendor" : "Bill to",
      partyName: customer?.name ?? "--",
      currency: inv.currency,
      issueDate: inv.issueDate,
      dueDate: inv.dueDate,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitMinor: l.unitPriceMinor,
        taxMinor: l.lineTaxMinor,
        amountMinor: l.amountMinor,
      })),
      subtotalMinor: inv.subtotalMinor,
      taxMinor: inv.taxMinor,
      totalMinor: inv.totalMinor,
      paidMinor: inv.amountPaidMinor,
      notes: inv.notes,
    });

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${inv.docNumber}.pdf"`,
      },
    });
  }, { route: "GET /api/invoices/[id]/pdf" });
}
