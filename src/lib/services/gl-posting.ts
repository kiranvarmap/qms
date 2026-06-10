/**
 * GL auto-posting (blueprint 04 §7, audit 02 §5 — "nothing posts
 * automatically"). Operational events project balanced journal entries onto
 * a small convention-based system chart of accounts (find-or-create by code),
 * so the trial balance reflects operations without manual bookkeeping.
 *
 * Idempotency: one journal entry per (eventType, aggregateId) — the consumer
 * checks `journal_entries.source_type = eventType AND source_id = aggregateId`
 * before posting, so retried events never double-book.
 *
 * Covered now: AR invoice issue, customer payment, expense reimbursement,
 * invoice void (reversing entry). COGS-at-shipment and AP bills follow once
 * valuation/bill flows land (tracked in the audit register).
 */
import { db } from "@/lib/db";
import { invoices, payments, expenses, journalEntries, journalLines, ledgerAccounts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { nextDocNumber } from "@/lib/services/document-sequence";
import type { Tx } from "@/lib/services/inventory";

// Well-known system accounts (workspace-scoped, created on first use).
const SYSTEM_ACCOUNTS = {
  cash: { code: "1000", name: "Cash and Bank", type: "asset" },
  ar: { code: "1100", name: "Accounts Receivable", type: "asset" },
  ap: { code: "2100", name: "Accounts Payable", type: "liability" },
  tax: { code: "2200", name: "Tax Payable", type: "liability" },
  revenue: { code: "4000", name: "Sales Revenue", type: "income" },
  opex: { code: "6000", name: "Operating Expenses", type: "expense" },
} as const;

type SystemAccountKey = keyof typeof SYSTEM_ACCOUNTS;

async function systemAccount(tx: Tx, workspaceId: string, key: SystemAccountKey): Promise<string> {
  const def = SYSTEM_ACCOUNTS[key];
  const [existing] = await tx
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.workspaceId, workspaceId), eq(ledgerAccounts.code, def.code)))
    .limit(1);
  if (existing) return existing.id;
  const [created] = await tx
    .insert(ledgerAccounts)
    .values({ workspaceId, code: def.code, name: def.name, type: def.type })
    .onConflictDoNothing()
    .returning();
  if (created) return created.id;
  // Lost a race — the row exists now.
  const [again] = await tx
    .select({ id: ledgerAccounts.id })
    .from(ledgerAccounts)
    .where(and(eq(ledgerAccounts.workspaceId, workspaceId), eq(ledgerAccounts.code, def.code)))
    .limit(1);
  return again.id;
}

interface PostingLine {
  account: SystemAccountKey;
  debitMinor?: number;
  creditMinor?: number;
  memo?: string;
}

/** Already posted for this event × aggregate? */
export async function glEntryExists(eventType: string, sourceId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: journalEntries.id })
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, eventType), eq(journalEntries.sourceId, sourceId)))
    .limit(1);
  return Boolean(existing);
}

async function postEntry(
  workspaceId: string,
  eventType: string,
  sourceId: string,
  memo: string,
  lines: PostingLine[],
  actorUserId: string | null
): Promise<void> {
  const clean = lines.filter((l) => (l.debitMinor ?? 0) > 0 || (l.creditMinor ?? 0) > 0);
  const debits = clean.reduce((s, l) => s + (l.debitMinor ?? 0), 0);
  const credits = clean.reduce((s, l) => s + (l.creditMinor ?? 0), 0);
  if (clean.length === 0 || debits !== credits) return; // never book unbalanced

  await db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "journal_entry" });
    const [je] = await tx
      .insert(journalEntries)
      .values({
        workspaceId,
        docNumber,
        memo,
        status: "posted",
        postedAt: new Date(),
        sourceType: eventType,
        sourceId,
        createdBy: actorUserId,
      })
      .returning();

    for (let i = 0; i < clean.length; i++) {
      const l = clean[i];
      await tx.insert(journalLines).values({
        journalEntryId: je.id,
        accountId: await systemAccount(tx, workspaceId, l.account),
        debitMinor: l.debitMinor ?? 0,
        creditMinor: l.creditMinor ?? 0,
        memo: l.memo ?? null,
        position: i,
      });
    }
  });
}

/** invoice.sent (AR): Dr AR / Cr Revenue + Cr Tax. */
export async function postInvoiceIssued(invoiceId: string, actorUserId: string | null): Promise<void> {
  if (await glEntryExists("invoice.sent", invoiceId)) return;
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);
  if (!inv || inv.kind !== "ar" || inv.totalMinor <= 0) return;

  await postEntry(inv.workspaceId, "invoice.sent", invoiceId, `Invoice ${inv.docNumber} issued`, [
    { account: "ar", debitMinor: inv.totalMinor, memo: inv.docNumber },
    { account: "revenue", creditMinor: inv.totalMinor - inv.taxMinor, memo: inv.docNumber },
    { account: "tax", creditMinor: inv.taxMinor, memo: inv.docNumber },
  ], actorUserId);
}

/** payment.recorded: Dr Cash / Cr AR. */
export async function postPaymentRecorded(paymentId: string, actorUserId: string | null): Promise<void> {
  if (await glEntryExists("payment.recorded", paymentId)) return;
  const [pay] = await db.select().from(payments).where(eq(payments.id, paymentId)).limit(1);
  if (!pay || pay.amountMinor <= 0) return;
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, pay.invoiceId)).limit(1);
  if (!inv) return;

  await postEntry(inv.workspaceId, "payment.recorded", paymentId, `Payment on ${inv.docNumber}`, [
    { account: "cash", debitMinor: pay.amountMinor, memo: inv.docNumber },
    { account: "ar", creditMinor: pay.amountMinor, memo: inv.docNumber },
  ], actorUserId);
}

/** expense.reimbursed: Dr OpEx / Cr Cash. */
export async function postExpenseReimbursed(expenseId: string, actorUserId: string | null): Promise<void> {
  if (await glEntryExists("expense.reimbursed", expenseId)) return;
  const [exp] = await db.select().from(expenses).where(eq(expenses.id, expenseId)).limit(1);
  if (!exp || exp.amountMinor <= 0) return;

  await postEntry(exp.workspaceId, "expense.reimbursed", expenseId, `Expense ${exp.docNumber} reimbursed`, [
    { account: "opex", debitMinor: exp.amountMinor, memo: exp.docNumber },
    { account: "cash", creditMinor: exp.amountMinor, memo: exp.docNumber },
  ], actorUserId);
}

/** invoice.voided: reverse the issue entry, if one was booked. */
export async function postInvoiceVoided(invoiceId: string, actorUserId: string | null): Promise<void> {
  if (await glEntryExists("invoice.voided", invoiceId)) return;
  const [issued] = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, "invoice.sent"), eq(journalEntries.sourceId, invoiceId)))
    .limit(1);
  if (!issued) return; // never issued → nothing to reverse

  const lines = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, issued.id));
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1);

  await db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId: issued.workspaceId, docType: "journal_entry" });
    const [je] = await tx
      .insert(journalEntries)
      .values({
        workspaceId: issued.workspaceId,
        docNumber,
        memo: `Reversal of ${issued.docNumber} (invoice ${inv?.docNumber ?? ""} voided)`,
        status: "posted",
        postedAt: new Date(),
        sourceType: "invoice.voided",
        sourceId: invoiceId,
        createdBy: actorUserId,
      })
      .returning();
    for (const l of lines) {
      await tx.insert(journalLines).values({
        journalEntryId: je.id,
        accountId: l.accountId,
        debitMinor: l.creditMinor, // swapped
        creditMinor: l.debitMinor,
        memo: l.memo,
        position: l.position,
      });
    }
  });
}
