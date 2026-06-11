/**
 * Expenses — full BRD extensions.
 *
 * Category policy limits, cash advances, corporate-card import + matching, and
 * billable-expense lookup for re-invoicing. Policy evaluation at submit lives in
 * the submit route; this file owns the admin/data operations.
 */

import { db } from "@/lib/db";
import { expenseCategories, expenseAdvances, cardTransactions, expenses } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { toMinor } from "@/lib/money";
import { nextDocNumber } from "@/lib/services/document-sequence";

// ── Category policy ───────────────────────────────────────────────────
export async function setCategoryPolicy(workspaceId: string, categoryId: string, maxAmount: number, receiptRequiredAbove: number) {
  const [cat] = await db.update(expenseCategories)
    .set({ maxAmountMinor: toMinor(maxAmount), receiptRequiredAboveMinor: toMinor(receiptRequiredAbove) })
    .where(and(eq(expenseCategories.id, categoryId), eq(expenseCategories.workspaceId, workspaceId)))
    .returning();
  return cat ?? null;
}

// ── Cash advances ─────────────────────────────────────────────────────
export function listAdvances(workspaceId: string) {
  return db.select().from(expenseAdvances).where(eq(expenseAdvances.workspaceId, workspaceId)).orderBy(desc(expenseAdvances.createdAt));
}
export async function createAdvance(workspaceId: string, input: { employeeId: string; amount: number; note?: string }, userId: string) {
  return db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "expense_advance" });
    const [adv] = await tx.insert(expenseAdvances).values({
      workspaceId, docNumber, employeeId: input.employeeId, amountMinor: toMinor(input.amount), note: input.note || null, createdBy: userId,
    }).returning();
    return adv;
  });
}
export async function decideAdvance(workspaceId: string, id: string, decision: "approved" | "settled", settledAmount?: number) {
  const patch: Record<string, unknown> = { status: decision };
  if (decision === "settled" && settledAmount !== undefined) patch.settledMinor = toMinor(settledAmount);
  const [adv] = await db.update(expenseAdvances).set(patch).where(and(eq(expenseAdvances.id, id), eq(expenseAdvances.workspaceId, workspaceId))).returning();
  return adv ?? null;
}

// ── Corporate-card import + matching ──────────────────────────────────
export function listCardTransactions(workspaceId: string) {
  return db.select().from(cardTransactions).where(eq(cardTransactions.workspaceId, workspaceId)).orderBy(desc(cardTransactions.createdAt));
}
export async function importCardTransactions(workspaceId: string, txns: { postedDate?: string; description?: string; amount: number; last4?: string }[]) {
  if (txns.length === 0) return [];
  return db.insert(cardTransactions).values(txns.map((t) => ({
    workspaceId, postedDate: t.postedDate ? new Date(t.postedDate) : null,
    description: t.description || null, amountMinor: toMinor(t.amount), last4: t.last4 || null,
  }))).returning();
}
export async function matchCardTransaction(workspaceId: string, id: string, expenseId: string) {
  const [txn] = await db.update(cardTransactions)
    .set({ status: "matched", matchedExpenseId: expenseId })
    .where(and(eq(cardTransactions.id, id), eq(cardTransactions.workspaceId, workspaceId)))
    .returning();
  if (txn) await db.update(expenses).set({ cardTransactionId: id }).where(eq(expenses.id, expenseId));
  return txn ?? null;
}

// ── Billable expenses (for re-invoicing) ──────────────────────────────
export function listBillableExpenses(workspaceId: string, customerId?: string) {
  const conds = [eq(expenses.workspaceId, workspaceId), eq(expenses.billable, true), isNull(expenses.billedInvoiceId)];
  if (customerId) conds.push(eq(expenses.customerId, customerId));
  return db.select().from(expenses).where(and(...conds)).orderBy(desc(expenses.spentAt));
}
