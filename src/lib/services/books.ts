/**
 * Invoicing & Books — full BRD.
 *
 * AP bills (kind='ap'), credit notes, write-offs, recurring invoices, dunning,
 * and double-entry accounting (chart of ledgerAccounts + journals → trial balance).
 * Reuses the AR invoice line/totals helper; events via the outbox.
 */

import { db } from "@/lib/db";
import {
  invoices, creditNotes, ledgerAccounts, journalEntries, journalLines, recurringInvoices, dunningLog,
} from "@/lib/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { toMinor } from "@/lib/money";
import { emitEvent } from "@/lib/events/outbox";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { writeInvoiceLinesAndTotals, paymentStatus } from "@/lib/services/invoices";

// ── AP bills ──────────────────────────────────────────────────────────
export interface ApBillLine { description: string; quantity: number; unitPrice: number; }
export interface ApBillInput { vendorId: string; purchaseOrderId?: string; dueDate?: string; currency?: string; notes?: string; lines?: ApBillLine[]; }

export function listInvoicesByKind(workspaceId: string, kind: "ar" | "ap") {
  return db.select().from(invoices).where(and(eq(invoices.workspaceId, workspaceId), eq(invoices.kind, kind))).orderBy(desc(invoices.createdAt));
}

export async function createApBill(workspaceId: string, input: ApBillInput, userId: string) {
  return db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "invoice", prefix: "BILL-" });
    const [bill] = await tx.insert(invoices).values({
      workspaceId, kind: "ap", vendorId: input.vendorId, purchaseOrderId: input.purchaseOrderId || null,
      docNumber, status: "draft", currency: input.currency ?? "USD",
      dueDate: input.dueDate ? new Date(input.dueDate) : null, notes: input.notes || null, createdBy: userId,
    }).returning();
    const totals = await writeInvoiceLinesAndTotals(tx, workspaceId, bill.id, (input.lines ?? []).map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })));
    await tx.update(invoices).set({ subtotalMinor: totals.subtotalMinor, taxMinor: totals.taxMinor, totalMinor: totals.totalMinor, updatedAt: new Date() }).where(eq(invoices.id, bill.id));
    await emitEvent(tx, { workspaceId, eventType: "invoice.created", aggregateType: "invoice", aggregateId: bill.id, actorUserId: userId, payload: { kind: "ap", docNumber, vendorId: input.vendorId } });
    return { ...bill, ...totals };
  });
}

// ── Write-off ─────────────────────────────────────────────────────────
export async function writeOffInvoice(workspaceId: string, invoiceId: string, amount: number, userId: string) {
  return db.transaction(async (tx) => {
    const [inv] = await tx.select().from(invoices).where(and(eq(invoices.id, invoiceId), eq(invoices.workspaceId, workspaceId))).limit(1);
    if (!inv) return null;
    const writeOff = inv.writeOffMinor + toMinor(amount);
    const settled = inv.amountPaidMinor + writeOff >= inv.totalMinor;
    const [updated] = await tx.update(invoices).set({ writeOffMinor: writeOff, status: settled ? "paid" : inv.status, updatedAt: new Date() }).where(eq(invoices.id, invoiceId)).returning();
    await emitEvent(tx, { workspaceId, eventType: "invoice.written_off", aggregateType: "invoice", aggregateId: invoiceId, actorUserId: userId, payload: { amountMinor: toMinor(amount) } });
    return updated;
  });
}

// ── Credit notes ──────────────────────────────────────────────────────
export function listCreditNotes(workspaceId: string) {
  return db.select().from(creditNotes).where(eq(creditNotes.workspaceId, workspaceId)).orderBy(desc(creditNotes.createdAt));
}
export async function createCreditNote(workspaceId: string, input: { invoiceId?: string; customerId?: string; amount: number; reason?: string }, userId: string) {
  return db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "credit_note" });
    const [cn] = await tx.insert(creditNotes).values({
      workspaceId, docNumber, invoiceId: input.invoiceId || null, customerId: input.customerId || null,
      status: "issued", amountMinor: toMinor(input.amount), reason: input.reason || null, createdBy: userId,
    }).returning();
    await emitEvent(tx, { workspaceId, eventType: "creditnote.issued", aggregateType: "credit_note", aggregateId: cn.id, actorUserId: userId, payload: { docNumber, amountMinor: cn.amountMinor } });
    return cn;
  });
}
/** Apply a credit note to its invoice (reduces the open balance like a payment). */
export async function applyCreditNote(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [cn] = await tx.select().from(creditNotes).where(and(eq(creditNotes.id, id), eq(creditNotes.workspaceId, workspaceId))).limit(1);
    if (!cn) return { error: "not_found" as const };
    if (cn.status === "applied") return { error: "conflict" as const };
    if (!cn.invoiceId) return { error: "no_invoice" as const };
    const [inv] = await tx.select().from(invoices).where(eq(invoices.id, cn.invoiceId)).limit(1);
    if (!inv) return { error: "no_invoice" as const };
    const newPaid = inv.amountPaidMinor + cn.amountMinor;
    await tx.update(invoices).set({ amountPaidMinor: newPaid, status: paymentStatus(newPaid, inv.totalMinor), updatedAt: new Date() }).where(eq(invoices.id, inv.id));
    await tx.update(creditNotes).set({ status: "applied", appliedAt: new Date() }).where(eq(creditNotes.id, id));
    await emitEvent(tx, { workspaceId, eventType: "creditnote.applied", aggregateType: "credit_note", aggregateId: id, actorUserId: userId, payload: { invoiceId: inv.id, amountMinor: cn.amountMinor } });
    return { ok: true };
  });
}

// ── Chart of ledgerAccounts ─────────────────────────────────────────────────
export function listAccounts(workspaceId: string) {
  return db.select().from(ledgerAccounts).where(eq(ledgerAccounts.workspaceId, workspaceId)).orderBy(asc(ledgerAccounts.code));
}
export function createAccount(workspaceId: string, input: { code: string; name: string; type: "asset" | "liability" | "equity" | "income" | "expense" }) {
  return db.insert(ledgerAccounts).values({ workspaceId, code: input.code, name: input.name, type: input.type }).returning().then((r) => r[0]);
}

// ── Journals ──────────────────────────────────────────────────────────
export interface JournalLineInput { accountId: string; debit?: number; credit?: number; memo?: string; }
export function listJournals(workspaceId: string) {
  return db.select().from(journalEntries).where(eq(journalEntries.workspaceId, workspaceId)).orderBy(desc(journalEntries.createdAt));
}
export async function createJournal(workspaceId: string, input: { entryDate?: string; memo?: string; post?: boolean; lines: JournalLineInput[] }, userId: string) {
  const totalDebit = input.lines.reduce((s, l) => s + toMinor(l.debit ?? 0), 0);
  const totalCredit = input.lines.reduce((s, l) => s + toMinor(l.credit ?? 0), 0);
  if (totalDebit !== totalCredit) return { error: "unbalanced" as const, totalDebit, totalCredit };
  return db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "journal_entry" });
    const posting = Boolean(input.post);
    const [je] = await tx.insert(journalEntries).values({
      workspaceId, docNumber, entryDate: input.entryDate ? new Date(input.entryDate) : new Date(),
      memo: input.memo || null, status: posting ? "posted" : "draft", postedAt: posting ? new Date() : null, createdBy: userId,
    }).returning();
    await tx.insert(journalLines).values(input.lines.map((l, i) => ({
      journalEntryId: je.id, accountId: l.accountId, debitMinor: toMinor(l.debit ?? 0), creditMinor: toMinor(l.credit ?? 0), memo: l.memo || null, position: i,
    })));
    if (posting) await emitEvent(tx, { workspaceId, eventType: "journal.posted", aggregateType: "journal_entry", aggregateId: je.id, actorUserId: userId, payload: { docNumber } });
    return { entry: je };
  });
}

/** Trial balance — net debit/credit per account from POSTED journals. */
export async function trialBalance(workspaceId: string) {
  const rows = await db
    .select({
      accountId: ledgerAccounts.id, code: ledgerAccounts.code, name: ledgerAccounts.name, type: ledgerAccounts.type,
      debit: sql<number>`coalesce(sum(${journalLines.debitMinor}), 0)`,
      credit: sql<number>`coalesce(sum(${journalLines.creditMinor}), 0)`,
    })
    .from(ledgerAccounts)
    .leftJoin(journalLines, eq(journalLines.accountId, ledgerAccounts.id))
    .leftJoin(journalEntries, eq(journalEntries.id, journalLines.journalEntryId))
    .where(and(eq(ledgerAccounts.workspaceId, workspaceId), sql`(${journalEntries.status} = 'posted' OR ${journalEntries.id} IS NULL)`))
    .groupBy(ledgerAccounts.id);
  return rows.map((r) => ({ ...r, debit: Number(r.debit), credit: Number(r.credit), balanceMinor: Number(r.debit) - Number(r.credit) }));
}

// ── Recurring invoices ────────────────────────────────────────────────
export function listRecurringInvoices(workspaceId: string) {
  return db.select().from(recurringInvoices).where(eq(recurringInvoices.workspaceId, workspaceId)).orderBy(desc(recurringInvoices.createdAt));
}
export function createRecurringInvoice(workspaceId: string, input: { customerId: string; name: string; cadence?: string; lines?: { description: string; quantity: number; unitPrice: number }[] }) {
  return db.insert(recurringInvoices).values({ workspaceId, customerId: input.customerId, name: input.name, cadence: input.cadence ?? "monthly", nextRunDate: new Date(), template: { lines: input.lines ?? [] } }).returning().then((r) => r[0]);
}
const CADENCE_DAYS: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 91 };
export async function generateRecurringInvoice(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [ri] = await tx.select().from(recurringInvoices).where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.workspaceId, workspaceId))).limit(1);
    if (!ri) return { error: "not_found" as const };
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "invoice" });
    const [inv] = await tx.insert(invoices).values({ workspaceId, kind: "ar", customerId: ri.customerId, docNumber, status: "draft", notes: `Recurring "${ri.name}"` }).returning();
    const totals = await writeInvoiceLinesAndTotals(tx, workspaceId, inv.id, (ri.template?.lines ?? []).map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice })));
    await tx.update(invoices).set({ subtotalMinor: totals.subtotalMinor, taxMinor: totals.taxMinor, totalMinor: totals.totalMinor }).where(eq(invoices.id, inv.id));
    const next = new Date(); next.setDate(next.getDate() + (CADENCE_DAYS[ri.cadence] ?? 30));
    await tx.update(recurringInvoices).set({ nextRunDate: next }).where(eq(recurringInvoices.id, id));
    await emitEvent(tx, { workspaceId, eventType: "invoice.created", aggregateType: "invoice", aggregateId: inv.id, actorUserId: userId, payload: { kind: "ar", docNumber, recurring: ri.name } });
    return { invoiceId: inv.id };
  });
}

// ── Dunning ───────────────────────────────────────────────────────────
export async function sendDunning(workspaceId: string, invoiceId: string, userId: string) {
  const prior = await db.select({ id: dunningLog.id }).from(dunningLog).where(eq(dunningLog.invoiceId, invoiceId));
  const [row] = await db.insert(dunningLog).values({ workspaceId, invoiceId, level: prior.length + 1 }).returning();
  await emitEvent(db, { workspaceId, eventType: "dunning.sent", aggregateType: "invoice", aggregateId: invoiceId, actorUserId: userId, payload: { level: row.level } });
  return row;
}
