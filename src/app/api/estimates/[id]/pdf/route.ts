import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimates, estimateLineItems, customers, workspaces } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { renderDocumentPdf } from "@/lib/services/document-pdf";

export const dynamic = "force-dynamic";

// GET /api/estimates/[id]/pdf — downloadable quote document (audit P5).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [est] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
    if (!est) return notFound();
    if (!(await hasModuleAccess(est.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const [ws] = await db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, est.workspaceId)).limit(1);
    const [customer] = await db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, est.customerId))
      .limit(1);
    const lines = await db
      .select()
      .from(estimateLineItems)
      .where(eq(estimateLineItems.estimateId, id))
      .orderBy(asc(estimateLineItems.position));

    const bytes = await renderDocumentPdf({
      docType: "ESTIMATE",
      docNumber: est.docNumber,
      status: est.status,
      companyName: ws?.name ?? "Workspace",
      partyLabel: "Prepared for",
      partyName: customer?.name ?? "--",
      currency: est.currency,
      issueDate: est.createdAt,
      dueDate: est.validUntil,
      lines: lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        unitMinor: l.unitPriceMinor,
        taxMinor: l.lineTaxMinor,
        amountMinor: l.amountMinor,
      })),
      subtotalMinor: est.subtotalMinor,
      taxMinor: est.taxMinor,
      totalMinor: est.totalMinor,
      notes: est.notes,
    });

    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${est.docNumber}.pdf"`,
      },
    });
  }, { route: "GET /api/estimates/[id]/pdf" });
}
