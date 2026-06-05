/**
 * Vendor — full BRD extensions.
 *
 * Structured addresses, compliance documents (+expiry status), bank accounts,
 * performance scorecards, vendor item catalog, and onboarding approval via the
 * shared approvals service. See docs/brd/00-platform-interoperability.md.
 */

import { db } from "@/lib/db";
import { vendorAddresses, vendorDocuments, vendorBankAccounts, vendorPerformance, vendorItems, vendors } from "@/lib/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { toMinor } from "@/lib/money";
import { createApprovalRequest } from "@/lib/services/approvals";

const EXPIRY_WARN_DAYS = 30;

function docStatus(expiry?: Date | null): "valid" | "expiring" | "expired" {
  if (!expiry) return "valid";
  const now = Date.now();
  const ms = expiry.getTime() - now;
  if (ms < 0) return "expired";
  if (ms < EXPIRY_WARN_DAYS * 86400000) return "expiring";
  return "valid";
}

// ── Aggregate read for the detail page ────────────────────────────────
export async function getVendorDetail(workspaceId: string, vendorId: string) {
  const [vendor] = await db.select().from(vendors).where(and(eq(vendors.id, vendorId), eq(vendors.workspaceId, workspaceId))).limit(1);
  if (!vendor) return null;
  const [addresses, documents, bankAccounts, performance, items] = await Promise.all([
    db.select().from(vendorAddresses).where(eq(vendorAddresses.vendorId, vendorId)),
    db.select().from(vendorDocuments).where(eq(vendorDocuments.vendorId, vendorId)).orderBy(asc(vendorDocuments.expiryDate)),
    db.select().from(vendorBankAccounts).where(eq(vendorBankAccounts.vendorId, vendorId)),
    db.select().from(vendorPerformance).where(eq(vendorPerformance.vendorId, vendorId)).orderBy(desc(vendorPerformance.createdAt)),
    db.select().from(vendorItems).where(eq(vendorItems.vendorId, vendorId)).orderBy(asc(vendorItems.description)),
  ]);
  return { vendor, addresses, documents, bankAccounts, performance, items };
}

// ── Addresses ─────────────────────────────────────────────────────────
export function addAddress(workspaceId: string, vendorId: string, input: { kind?: "billing" | "shipping" | "remit"; line1?: string; line2?: string; city?: string; state?: string; country?: string; postalCode?: string }) {
  return db.insert(vendorAddresses).values({ workspaceId, vendorId, kind: input.kind ?? "billing", line1: input.line1 || null, line2: input.line2 || null, city: input.city || null, state: input.state || null, country: input.country || null, postalCode: input.postalCode || null }).returning().then((r) => r[0]);
}
export function deleteAddress(workspaceId: string, id: string) {
  return db.delete(vendorAddresses).where(and(eq(vendorAddresses.id, id), eq(vendorAddresses.workspaceId, workspaceId)));
}

// ── Compliance documents ──────────────────────────────────────────────
export function addDocument(workspaceId: string, vendorId: string, input: { docType: string; number?: string; issuedDate?: string; expiryDate?: string; fileUrl?: string; isMandatory?: boolean }) {
  const expiry = input.expiryDate ? new Date(input.expiryDate) : null;
  return db.insert(vendorDocuments).values({
    workspaceId, vendorId, docType: input.docType, number: input.number || null,
    issuedDate: input.issuedDate ? new Date(input.issuedDate) : null, expiryDate: expiry,
    fileUrl: input.fileUrl || null, isMandatory: input.isMandatory ?? false, status: docStatus(expiry),
  }).returning().then((r) => r[0]);
}
export function deleteDocument(workspaceId: string, id: string) {
  return db.delete(vendorDocuments).where(and(eq(vendorDocuments.id, id), eq(vendorDocuments.workspaceId, workspaceId)));
}

// ── Bank accounts ─────────────────────────────────────────────────────
export function addBankAccount(workspaceId: string, vendorId: string, input: { accountName?: string; accountNumber?: string; bankName?: string; branch?: string; routing?: string }) {
  return db.insert(vendorBankAccounts).values({ workspaceId, vendorId, accountName: input.accountName || null, accountNumber: input.accountNumber || null, bankName: input.bankName || null, branch: input.branch || null, routing: input.routing || null }).returning().then((r) => r[0]);
}
export async function verifyBankAccount(workspaceId: string, id: string) {
  const [row] = await db.update(vendorBankAccounts).set({ isVerified: true }).where(and(eq(vendorBankAccounts.id, id), eq(vendorBankAccounts.workspaceId, workspaceId))).returning();
  return row ?? null;
}
export function deleteBankAccount(workspaceId: string, id: string) {
  return db.delete(vendorBankAccounts).where(and(eq(vendorBankAccounts.id, id), eq(vendorBankAccounts.workspaceId, workspaceId)));
}

// ── Performance ───────────────────────────────────────────────────────
export function addPerformance(workspaceId: string, vendorId: string, input: { periodStart?: string; periodEnd?: string; onTimePct?: number; qualityRejectPct?: number; priceVariancePct?: number; rating?: number; note?: string }) {
  return db.insert(vendorPerformance).values({
    workspaceId, vendorId,
    periodStart: input.periodStart ? new Date(input.periodStart) : null,
    periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
    onTimePct: input.onTimePct ?? 0, qualityRejectPct: input.qualityRejectPct ?? 0,
    priceVariancePct: input.priceVariancePct ?? 0, rating: input.rating ?? 0, note: input.note || null,
  }).returning().then((r) => r[0]);
}

// ── Vendor item catalog ───────────────────────────────────────────────
export function addVendorItem(workspaceId: string, vendorId: string, input: { productId?: string; vendorSku?: string; description?: string; unitPrice?: number; leadTimeDays?: number }) {
  return db.insert(vendorItems).values({
    workspaceId, vendorId, productId: input.productId || null, vendorSku: input.vendorSku || null,
    description: input.description || null, unitPriceMinor: toMinor(input.unitPrice ?? 0), leadTimeDays: input.leadTimeDays ?? 0,
  }).returning().then((r) => r[0]);
}
export function deleteVendorItem(workspaceId: string, id: string) {
  return db.delete(vendorItems).where(and(eq(vendorItems.id, id), eq(vendorItems.workspaceId, workspaceId)));
}

// ── Preferred flag ────────────────────────────────────────────────────
export async function setPreferred(workspaceId: string, vendorId: string, isPreferred: boolean) {
  const [v] = await db.update(vendors).set({ isPreferred, updatedAt: new Date() }).where(and(eq(vendors.id, vendorId), eq(vendors.workspaceId, workspaceId))).returning();
  return v ?? null;
}

// ── Onboarding approval (reuses the generic approvals service) ─────────
export async function submitVendorForApproval(workspaceId: string, vendorId: string, userId: string) {
  await db.update(vendors).set({ approvalState: "pending", updatedAt: new Date() }).where(and(eq(vendors.id, vendorId), eq(vendors.workspaceId, workspaceId)));
  await createApprovalRequest(db, { workspaceId, subjectType: "vendor", subjectId: vendorId, requestedBy: userId });
  return { ok: true };
}
