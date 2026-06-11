/**
 * Customer service — enterprise customer record (Zoho-parity).
 *
 * Owns create/update (with contact persons) and the detail read. `name` mirrors
 * `displayName` so existing list/joins keep working. Money is minor units.
 */

import { db } from "@/lib/db";
import { customers, customerContacts, estimates, salesOrders, invoices } from "@/lib/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { toMinor } from "@/lib/money";

type Address = Record<string, string | undefined>;
export interface CustomerContactInput {
  salutation?: string; firstName?: string; lastName?: string;
  email?: string; workPhone?: string; mobile?: string; isPrimary?: boolean;
}
export interface CustomerInput {
  customerType?: "business" | "individual";
  salutation?: string; firstName?: string; lastName?: string;
  companyName?: string; displayName: string; code?: string;
  email?: string; workPhone?: string; mobile?: string; customerLanguage?: string;
  gstTreatment?: string; placeOfSupply?: string; gstin?: string; pan?: string; taxId?: string;
  taxPreference?: "taxable" | "tax_exempt"; currency?: string; openingBalance?: number;
  paymentTermsLabel?: string; paymentTermsDays?: number; enablePortal?: boolean;
  billingAddress?: Address; shippingAddress?: Address;
  contacts?: CustomerContactInput[];
  customFields?: Record<string, unknown>; reportingTags?: Record<string, string>;
  documents?: { name: string; url: string }[];
  accountManagerEmployeeId?: string; boardId?: string; notes?: string;
}

function columns(input: Partial<CustomerInput>) {
  const c: Record<string, unknown> = {};
  if (input.customerType !== undefined) c.customerType = input.customerType;
  if (input.salutation !== undefined) c.salutation = input.salutation || null;
  if (input.firstName !== undefined) c.firstName = input.firstName || null;
  if (input.lastName !== undefined) c.lastName = input.lastName || null;
  if (input.companyName !== undefined) c.companyName = input.companyName || null;
  if (input.displayName !== undefined) { c.displayName = input.displayName; c.name = input.displayName; }
  if (input.code !== undefined) c.code = input.code || null;
  if (input.email !== undefined) c.email = input.email || null;
  if (input.workPhone !== undefined) { c.workPhone = input.workPhone || null; c.phone = input.workPhone || null; }
  if (input.mobile !== undefined) c.mobile = input.mobile || null;
  if (input.customerLanguage !== undefined) c.customerLanguage = input.customerLanguage || "English";
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
  if (input.enablePortal !== undefined) c.enablePortal = input.enablePortal;
  if (input.billingAddress !== undefined) c.billingAddress = input.billingAddress;
  if (input.shippingAddress !== undefined) c.shippingAddress = input.shippingAddress;
  if (input.customFields !== undefined) c.customFields = input.customFields;
  if (input.reportingTags !== undefined) c.reportingTags = input.reportingTags;
  if (input.documents !== undefined) c.documents = input.documents;
  if (input.accountManagerEmployeeId !== undefined) c.accountManagerEmployeeId = input.accountManagerEmployeeId || null;
  if (input.boardId !== undefined) c.boardId = input.boardId || null;
  if (input.notes !== undefined) c.notes = input.notes || null;
  return c;
}

async function writeContacts(tx: typeof db, workspaceId: string, customerId: string, contacts: CustomerContactInput[]) {
  await tx.delete(customerContacts).where(eq(customerContacts.customerId, customerId));
  const rows = contacts.filter((k) => k.firstName || k.lastName || k.email);
  if (rows.length > 0) {
    await tx.insert(customerContacts).values(rows.map((k, i) => ({
      workspaceId, customerId,
      salutation: k.salutation || null, firstName: k.firstName || null, lastName: k.lastName || null,
      email: k.email || null, workPhone: k.workPhone || null, mobile: k.mobile || null,
      isPrimary: k.isPrimary ?? false, position: i,
    })));
  }
}

export async function createCustomer(workspaceId: string, input: CustomerInput, userId: string) {
  return db.transaction(async (tx) => {
    const [customer] = await tx
      .insert(customers)
      .values({ workspaceId, name: input.displayName, ...columns(input), createdBy: userId })
      .returning();
    if (input.contacts?.length) await writeContacts(tx as unknown as typeof db, workspaceId, customer.id, input.contacts);
    return customer;
  });
}

export async function updateCustomer(workspaceId: string, id: string, patch: Partial<CustomerInput> & { status?: "active" | "inactive" }) {
  return db.transaction(async (tx) => {
    const set: Record<string, unknown> = { ...columns(patch), updatedAt: new Date() };
    if (patch.status !== undefined) set.status = patch.status;
    const [customer] = await tx.update(customers).set(set).where(and(eq(customers.id, id), eq(customers.workspaceId, workspaceId))).returning();
    if (!customer) return null;
    if (patch.contacts !== undefined) await writeContacts(tx as unknown as typeof db, workspaceId, id, patch.contacts);
    return customer;
  });
}

export async function getCustomerDetail(workspaceId: string, id: string) {
  const [customer] = await db.select().from(customers).where(and(eq(customers.id, id), eq(customers.workspaceId, workspaceId))).limit(1);
  if (!customer) return null;
  const contacts = await db.select().from(customerContacts).where(eq(customerContacts.customerId, id)).orderBy(asc(customerContacts.position));

  // 360° roll-ups (audit 02 §1: the customer page had no related documents/AR).
  const recentEstimates = await db
    .select({ id: estimates.id, docNumber: estimates.docNumber, status: estimates.status, totalMinor: estimates.totalMinor, createdAt: estimates.createdAt })
    .from(estimates)
    .where(and(eq(estimates.customerId, id), eq(estimates.workspaceId, workspaceId)))
    .orderBy(desc(estimates.createdAt))
    .limit(20);
  const recentSalesOrders = await db
    .select({ id: salesOrders.id, docNumber: salesOrders.docNumber, status: salesOrders.status, totalMinor: salesOrders.totalMinor, createdAt: salesOrders.createdAt })
    .from(salesOrders)
    .where(and(eq(salesOrders.customerId, id), eq(salesOrders.workspaceId, workspaceId)))
    .orderBy(desc(salesOrders.createdAt))
    .limit(20);
  const recentInvoices = await db
    .select({ id: invoices.id, docNumber: invoices.docNumber, status: invoices.status, totalMinor: invoices.totalMinor, amountPaidMinor: invoices.amountPaidMinor, dueDate: invoices.dueDate, createdAt: invoices.createdAt })
    .from(invoices)
    .where(and(eq(invoices.customerId, id), eq(invoices.workspaceId, workspaceId), eq(invoices.kind, "ar")))
    .orderBy(desc(invoices.createdAt))
    .limit(20);

  const [ar] = await db
    .select({
      outstanding: sql<number>`coalesce(sum(${invoices.totalMinor} - ${invoices.amountPaidMinor}), 0)`,
      overdue: sql<number>`coalesce(sum(case when ${invoices.status} = 'overdue' then ${invoices.totalMinor} - ${invoices.amountPaidMinor} else 0 end), 0)`,
      lifetime: sql<number>`coalesce(sum(${invoices.totalMinor}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.customerId, id),
        eq(invoices.workspaceId, workspaceId),
        eq(invoices.kind, "ar"),
        inArray(invoices.status, ["sent", "partially_paid", "paid", "overdue"])
      )
    );

  return {
    ...customer,
    contacts,
    estimates: recentEstimates,
    salesOrders: recentSalesOrders,
    invoices: recentInvoices,
    arOutstandingMinor: Number(ar?.outstanding ?? 0),
    arOverdueMinor: Number(ar?.overdue ?? 0),
    lifetimeBilledMinor: Number(ar?.lifetime ?? 0),
  };
}
