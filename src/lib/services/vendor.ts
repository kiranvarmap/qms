/**
 * Vendor service — enterprise vendor record (Zoho-parity, mirrors customer.ts).
 *
 * Owns create/update (with contact persons + bank accounts) and the detail
 * read. `name` mirrors `displayName` so existing list/joins keep working.
 * Money is minor units.
 */

import { db } from "@/lib/db";
import { vendors, vendorContacts, vendorBankAccounts } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { toMinor } from "@/lib/money";

type Address = Record<string, string | undefined>;
export interface VendorContactInput {
  salutation?: string; firstName?: string; lastName?: string;
  email?: string; workPhone?: string; mobile?: string; isPrimary?: boolean;
}
export interface VendorBankInput {
  accountName?: string; accountNumber?: string; bankName?: string; branch?: string; routing?: string;
}
export interface VendorInput {
  vendorType?: "business" | "individual";
  salutation?: string; firstName?: string; lastName?: string;
  companyName?: string; displayName: string; code?: string;
  email?: string; workPhone?: string; mobile?: string; vendorLanguage?: string;
  gstTreatment?: string; placeOfSupply?: string; gstin?: string; pan?: string; taxId?: string;
  taxPreference?: "taxable" | "tax_exempt"; currency?: string; openingBalance?: number;
  paymentTermsLabel?: string; paymentTermsDays?: number;
  billingAddress?: Address; shippingAddress?: Address;
  contacts?: VendorContactInput[]; bankAccounts?: VendorBankInput[];
  customFields?: Record<string, unknown>; reportingTags?: Record<string, string>;
  documents?: { name: string; url: string }[];
  accountManagerEmployeeId?: string; notes?: string;
}

function columns(input: Partial<VendorInput>) {
  const c: Record<string, unknown> = {};
  if (input.vendorType !== undefined) c.vendorType = input.vendorType;
  if (input.salutation !== undefined) c.salutation = input.salutation || null;
  if (input.firstName !== undefined) c.firstName = input.firstName || null;
  if (input.lastName !== undefined) c.lastName = input.lastName || null;
  if (input.companyName !== undefined) c.companyName = input.companyName || null;
  if (input.displayName !== undefined) { c.displayName = input.displayName; c.name = input.displayName; }
  if (input.code !== undefined) c.code = input.code || null;
  if (input.email !== undefined) c.email = input.email || null;
  if (input.workPhone !== undefined) { c.workPhone = input.workPhone || null; c.phone = input.workPhone || null; }
  if (input.mobile !== undefined) c.mobile = input.mobile || null;
  if (input.vendorLanguage !== undefined) c.vendorLanguage = input.vendorLanguage || "English";
  if (input.gstTreatment !== undefined) c.gstTreatment = input.gstTreatment || null;
  if (input.placeOfSupply !== undefined) c.placeOfSupply = input.placeOfSupply || null;
  if (input.gstin !== undefined) c.gstin = input.gstin || null;
  if (input.pan !== undefined) c.pan = input.pan || null;
  if (input.taxId !== undefined) c.taxId = input.taxId || null;
  if (input.taxPreference !== undefined) c.taxPreference = input.taxPreference;
  if (input.currency !== undefined) c.currency = input.currency || "INR";
  if (input.openingBalance !== undefined) c.openingBalanceMinor = toMinor(input.openingBalance);
  if (input.paymentTermsLabel !== undefined) c.paymentTermsLabel = input.paymentTermsLabel || "due_on_receipt";
  if (input.paymentTermsDays !== undefined) c.paymentTermsDays = input.paymentTermsDays;
  if (input.billingAddress !== undefined) c.billingAddress = input.billingAddress;
  if (input.shippingAddress !== undefined) c.shippingAddress = input.shippingAddress;
  if (input.customFields !== undefined) c.customFields = input.customFields;
  if (input.reportingTags !== undefined) c.reportingTags = input.reportingTags;
  if (input.documents !== undefined) c.documentsMeta = input.documents;
  if (input.accountManagerEmployeeId !== undefined) c.accountManagerEmployeeId = input.accountManagerEmployeeId || null;
  if (input.notes !== undefined) c.notes = input.notes || null;
  return c;
}

async function writeContacts(tx: typeof db, vendorId: string, contacts: VendorContactInput[]) {
  await tx.delete(vendorContacts).where(eq(vendorContacts.vendorId, vendorId));
  const rows = contacts.filter((k) => k.firstName || k.lastName || k.email);
  if (rows.length > 0) {
    await tx.insert(vendorContacts).values(rows.map((k, i) => ({
      vendorId,
      name: [k.firstName, k.lastName].filter(Boolean).join(" ") || null,
      salutation: k.salutation || null, firstName: k.firstName || null, lastName: k.lastName || null,
      email: k.email || null, workPhone: k.workPhone || null, mobile: k.mobile || null,
      phone: k.workPhone || k.mobile || null,
      isPrimary: k.isPrimary ?? false, position: i,
    })));
  }
}

async function writeBankAccounts(tx: typeof db, workspaceId: string, vendorId: string, accounts: VendorBankInput[]) {
  await tx.delete(vendorBankAccounts).where(eq(vendorBankAccounts.vendorId, vendorId));
  const rows = accounts.filter((b) => b.accountNumber || b.accountName || b.bankName);
  if (rows.length > 0) {
    await tx.insert(vendorBankAccounts).values(rows.map((b) => ({
      workspaceId, vendorId,
      accountName: b.accountName || null, accountNumber: b.accountNumber || null,
      bankName: b.bankName || null, branch: b.branch || null, routing: b.routing || null,
    })));
  }
}

export async function createVendor(workspaceId: string, input: VendorInput, userId: string) {
  return db.transaction(async (tx) => {
    const [vendor] = await tx
      .insert(vendors)
      .values({ workspaceId, name: input.displayName, ...columns(input), createdBy: userId })
      .returning();
    if (input.contacts?.length) await writeContacts(tx as unknown as typeof db, vendor.id, input.contacts);
    if (input.bankAccounts?.length) await writeBankAccounts(tx as unknown as typeof db, workspaceId, vendor.id, input.bankAccounts);
    return vendor;
  });
}

export async function updateVendor(workspaceId: string, id: string, patch: Partial<VendorInput> & { status?: "active" | "inactive" }) {
  return db.transaction(async (tx) => {
    const set: Record<string, unknown> = { ...columns(patch), updatedAt: new Date() };
    if (patch.status !== undefined) set.status = patch.status;
    const [vendor] = await tx.update(vendors).set(set).where(and(eq(vendors.id, id), eq(vendors.workspaceId, workspaceId))).returning();
    if (!vendor) return null;
    if (patch.contacts !== undefined) await writeContacts(tx as unknown as typeof db, id, patch.contacts);
    if (patch.bankAccounts !== undefined) await writeBankAccounts(tx as unknown as typeof db, workspaceId, id, patch.bankAccounts);
    return vendor;
  });
}

export async function getVendorDetail(workspaceId: string, id: string) {
  const [vendor] = await db.select().from(vendors).where(and(eq(vendors.id, id), eq(vendors.workspaceId, workspaceId))).limit(1);
  if (!vendor) return null;
  const contacts = await db.select().from(vendorContacts).where(eq(vendorContacts.vendorId, id)).orderBy(asc(vendorContacts.position));
  const bankAccounts = await db.select().from(vendorBankAccounts).where(eq(vendorBankAccounts.vendorId, id));
  return { ...vendor, contacts, bankAccounts };
}
