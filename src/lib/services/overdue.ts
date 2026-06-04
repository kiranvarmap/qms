/**
 * Overdue-invoice sweep (Plan §6).
 *
 * Flags `sent`/`partially_paid` invoices whose due date has passed as `overdue`
 * and emits `invoice.overdue` (idempotent — only transitions invoices not
 * already overdue). Run from the events cron alongside the outbox dispatch.
 */

import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schema";
import { and, inArray, lt, isNotNull, eq } from "drizzle-orm";
import { emitEventStandalone } from "@/lib/events/outbox";

export async function sweepOverdueInvoices(now = new Date()): Promise<{ flagged: number }> {
  const due = await db
    .select()
    .from(invoices)
    .where(
      and(
        inArray(invoices.status, ["sent", "partially_paid"]),
        isNotNull(invoices.dueDate),
        lt(invoices.dueDate, now)
      )
    );

  for (const inv of due) {
    await db.update(invoices).set({ status: "overdue", updatedAt: new Date() }).where(eq(invoices.id, inv.id));
    await emitEventStandalone({
      workspaceId: inv.workspaceId,
      eventType: "invoice.overdue",
      aggregateType: "invoice",
      aggregateId: inv.id,
      payload: { docNumber: inv.docNumber, customerId: inv.customerId, boardId: inv.boardId, itemId: inv.itemId },
    });
  }

  return { flagged: due.length };
}
