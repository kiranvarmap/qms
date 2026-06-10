/**
 * Recurring-document generation sweep (audit 02 §4: templates existed but
 * nothing generated them — only a manual endpoint). Every active template
 * whose nextRunDate has passed produces its draft document; the generator
 * itself rolls nextRunDate forward inside its transaction, so a retried
 * sweep can't double-generate.
 */
import { db } from "@/lib/db";
import { recurringInvoices, recurringOrders } from "@/lib/db/schema";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { generateRecurringInvoice } from "@/lib/services/books";
import { generateRecurringOrder } from "@/lib/services/sales-extended";

export async function sweepRecurringDocs(now = new Date()): Promise<{ invoices: number; orders: number }> {
  let invoicesGenerated = 0;
  let ordersGenerated = 0;

  const dueInvoices = await db
    .select({ id: recurringInvoices.id, workspaceId: recurringInvoices.workspaceId })
    .from(recurringInvoices)
    .where(and(eq(recurringInvoices.isActive, true), isNotNull(recurringInvoices.nextRunDate), lte(recurringInvoices.nextRunDate, now)));
  for (const ri of dueInvoices) {
    const result = await generateRecurringInvoice(ri.workspaceId, ri.id, null);
    if (!("error" in result)) invoicesGenerated++;
  }

  const dueOrders = await db
    .select({ id: recurringOrders.id, workspaceId: recurringOrders.workspaceId })
    .from(recurringOrders)
    .where(and(eq(recurringOrders.isActive, true), isNotNull(recurringOrders.nextRunDate), lte(recurringOrders.nextRunDate, now)));
  for (const ro of dueOrders) {
    const result = await generateRecurringOrder(ro.workspaceId, ro.id, null);
    if (!("error" in result)) ordersGenerated++;
  }

  return { invoices: invoicesGenerated, orders: ordersGenerated };
}
