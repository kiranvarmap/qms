/**
 * Data import/export registry.
 *
 * One descriptor per importable/exportable entity. The generic export/import
 * routes (src/app/api/data-io/*) read this registry so every module shares a
 * single CSV code path. Money is stored as integer minor units but surfaced in
 * the CSV as major units (2dp).
 */

import {
  customers, vendors, products, taxRates, expenseCategories, ledgerAccounts,
  employees, warehouses, invoices, estimates, salesOrders, purchaseOrders, expenses,
} from "@/lib/db/schema";
import type { ModuleFlag } from "@/lib/services/access";

export type FieldType = "string" | "int" | "number" | "money" | "bool" | "date" | "json";

export interface FieldDef {
  header: string;        // CSV column header
  field: string;         // Drizzle column property name
  type: FieldType;
  required?: boolean;    // import: must be present & non-empty
  importable?: boolean;  // default true; false = export-only (e.g. id, computed)
}

export interface EntityDef {
  slug: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  table: any;
  accessFlag: ModuleFlag;
  keyField: string;      // upsert match column (within a workspace)
  importable: boolean;   // whether import is supported at all
  fields: FieldDef[];
  // Fill NOT-NULL columns absent from the CSV when inserting a new row.
  insertDerive?: (vals: Record<string, unknown>) => Record<string, unknown>;
}

const id: FieldDef = { header: "id", field: "id", type: "string", importable: false };

export const ENTITIES: Record<string, EntityDef> = {
  customers: {
    slug: "customers", label: "Customers", table: customers, accessFlag: "canAccessInvoicing",
    keyField: "code", importable: true,
    insertDerive: (v) => ({ name: v.displayName ?? v.companyName ?? "Customer", phone: v.workPhone ?? null }),
    fields: [
      id,
      { header: "code", field: "code", type: "string" },
      { header: "display_name", field: "displayName", type: "string", required: true },
      { header: "customer_type", field: "customerType", type: "string" },
      { header: "company_name", field: "companyName", type: "string" },
      { header: "first_name", field: "firstName", type: "string" },
      { header: "last_name", field: "lastName", type: "string" },
      { header: "email", field: "email", type: "string" },
      { header: "work_phone", field: "workPhone", type: "string" },
      { header: "mobile", field: "mobile", type: "string" },
      { header: "gstin", field: "gstin", type: "string" },
      { header: "pan", field: "pan", type: "string" },
      { header: "gst_treatment", field: "gstTreatment", type: "string" },
      { header: "place_of_supply", field: "placeOfSupply", type: "string" },
      { header: "currency", field: "currency", type: "string" },
      { header: "payment_terms_days", field: "paymentTermsDays", type: "int" },
      { header: "opening_balance", field: "openingBalanceMinor", type: "money" },
      { header: "status", field: "status", type: "string" },
    ],
  },
  vendors: {
    slug: "vendors", label: "Vendors", table: vendors, accessFlag: "canAccessVendors",
    keyField: "code", importable: true,
    insertDerive: (v) => ({ name: v.displayName ?? v.companyName ?? "Vendor", phone: v.workPhone ?? null }),
    fields: [
      id,
      { header: "code", field: "code", type: "string" },
      { header: "display_name", field: "displayName", type: "string", required: true },
      { header: "vendor_type", field: "vendorType", type: "string" },
      { header: "company_name", field: "companyName", type: "string" },
      { header: "email", field: "email", type: "string" },
      { header: "work_phone", field: "workPhone", type: "string" },
      { header: "mobile", field: "mobile", type: "string" },
      { header: "gstin", field: "gstin", type: "string" },
      { header: "pan", field: "pan", type: "string" },
      { header: "gst_treatment", field: "gstTreatment", type: "string" },
      { header: "currency", field: "currency", type: "string" },
      { header: "payment_terms_days", field: "paymentTermsDays", type: "int" },
      { header: "opening_balance", field: "openingBalanceMinor", type: "money" },
      { header: "status", field: "status", type: "string" },
    ],
  },
  products: {
    slug: "products", label: "Items / Products", table: products, accessFlag: "canAccessInventory",
    keyField: "sku", importable: true,
    fields: [
      id,
      { header: "sku", field: "sku", type: "string" },
      { header: "name", field: "name", type: "string", required: true },
      { header: "type", field: "type", type: "string" },
      { header: "category", field: "category", type: "string" },
      { header: "unit", field: "unit", type: "string" },
      { header: "description", field: "description", type: "string" },
      { header: "cost", field: "costMinor", type: "money" },
      { header: "price", field: "priceMinor", type: "money" },
      { header: "reorder_level", field: "reorderLevel", type: "number" },
      { header: "track_inventory", field: "trackInventory", type: "bool" },
      { header: "barcode", field: "barcode", type: "string" },
      { header: "is_active", field: "isActive", type: "bool" },
    ],
  },
  "tax-rates": {
    slug: "tax-rates", label: "Tax Rates", table: taxRates, accessFlag: "canAccessInvoicing",
    keyField: "name", importable: true,
    fields: [
      id,
      { header: "name", field: "name", type: "string", required: true },
      { header: "rate_basis_points", field: "rateBasisPoints", type: "int", required: true },
      { header: "type", field: "type", type: "string" },
      { header: "is_default", field: "isDefault", type: "bool" },
      { header: "is_active", field: "isActive", type: "bool" },
    ],
  },
  "expense-categories": {
    slug: "expense-categories", label: "Expense Categories", table: expenseCategories, accessFlag: "canAccessExpenses",
    keyField: "name", importable: true,
    fields: [
      id,
      { header: "name", field: "name", type: "string", required: true },
      { header: "max_amount", field: "maxAmountMinor", type: "money" },
      { header: "receipt_required_above", field: "receiptRequiredAboveMinor", type: "money" },
      { header: "is_active", field: "isActive", type: "bool" },
    ],
  },
  "ledger-accounts": {
    slug: "ledger-accounts", label: "Chart of Accounts", table: ledgerAccounts, accessFlag: "canAccessInvoicing",
    keyField: "code", importable: true,
    fields: [
      id,
      { header: "code", field: "code", type: "string", required: true },
      { header: "name", field: "name", type: "string", required: true },
      { header: "type", field: "type", type: "string", required: true },
      { header: "is_active", field: "isActive", type: "bool" },
    ],
  },
  employees: {
    slug: "employees", label: "Employees", table: employees, accessFlag: "canAccessHR",
    keyField: "employeeId", importable: true,
    fields: [
      id,
      { header: "employee_id", field: "employeeId", type: "string", required: true },
      { header: "name", field: "name", type: "string", required: true },
      { header: "email", field: "email", type: "string" },
      { header: "phone", field: "phone", type: "string" },
      { header: "department", field: "department", type: "string" },
      { header: "designation", field: "designation", type: "string" },
      { header: "employment_type", field: "employmentType", type: "string" },
      { header: "status", field: "status", type: "string" },
    ],
  },
  warehouses: {
    slug: "warehouses", label: "Warehouses", table: warehouses, accessFlag: "canAccessInventory",
    keyField: "code", importable: true,
    fields: [
      id,
      { header: "code", field: "code", type: "string" },
      { header: "name", field: "name", type: "string", required: true },
      { header: "location", field: "location", type: "string" },
      { header: "is_default", field: "isDefault", type: "bool" },
      { header: "is_active", field: "isActive", type: "bool" },
    ],
  },

  // ── Transactional documents: export-only (header level) ───────────
  invoices: {
    slug: "invoices", label: "Invoices", table: invoices, accessFlag: "canAccessInvoicing",
    keyField: "docNumber", importable: false,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string" },
      { header: "status", field: "status", type: "string" },
      { header: "customer_id", field: "customerId", type: "string" },
      { header: "currency", field: "currency", type: "string" },
      { header: "subtotal", field: "subtotalMinor", type: "money" },
      { header: "tax", field: "taxMinor", type: "money" },
      { header: "total", field: "totalMinor", type: "money" },
      { header: "amount_paid", field: "amountPaidMinor", type: "money" },
      { header: "issue_date", field: "issueDate", type: "date" },
      { header: "due_date", field: "dueDate", type: "date" },
    ],
  },
  estimates: {
    slug: "estimates", label: "Quotes / Estimates", table: estimates, accessFlag: "canAccessInvoicing",
    keyField: "docNumber", importable: false,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string" },
      { header: "status", field: "status", type: "string" },
      { header: "customer_id", field: "customerId", type: "string" },
      { header: "currency", field: "currency", type: "string" },
      { header: "total", field: "totalMinor", type: "money" },
      { header: "valid_until", field: "validUntil", type: "date" },
    ],
  },
  "sales-orders": {
    slug: "sales-orders", label: "Sales Orders", table: salesOrders, accessFlag: "canAccessInvoicing",
    keyField: "docNumber", importable: false,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string" },
      { header: "status", field: "status", type: "string" },
      { header: "customer_id", field: "customerId", type: "string" },
      { header: "currency", field: "currency", type: "string" },
      { header: "total", field: "totalMinor", type: "money" },
    ],
  },
  "purchase-orders": {
    slug: "purchase-orders", label: "Purchase Orders", table: purchaseOrders, accessFlag: "canAccessPurchasing",
    keyField: "docNumber", importable: false,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string" },
      { header: "status", field: "status", type: "string" },
      { header: "vendor_id", field: "vendorId", type: "string" },
      { header: "currency", field: "currency", type: "string" },
      { header: "subtotal", field: "subtotalMinor", type: "money" },
      { header: "tax", field: "taxMinor", type: "money" },
      { header: "total", field: "totalMinor", type: "money" },
      { header: "order_date", field: "orderDate", type: "date" },
      { header: "delivery_date", field: "expectedDate", type: "date" },
    ],
  },
  expenses: {
    slug: "expenses", label: "Expenses", table: expenses, accessFlag: "canAccessExpenses",
    keyField: "docNumber", importable: false,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string" },
      { header: "status", field: "status", type: "string" },
      { header: "vendor_id", field: "vendorId", type: "string" },
      { header: "customer_id", field: "customerId", type: "string" },
      { header: "currency", field: "currency", type: "string" },
      { header: "amount", field: "amountMinor", type: "money" },
      { header: "invoice_number", field: "invoiceNumber", type: "string" },
      { header: "spent_at", field: "spentAt", type: "date" },
    ],
  },
};

export function getEntity(slug: string): EntityDef | undefined {
  return ENTITIES[slug];
}
