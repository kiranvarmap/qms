/**
 * Client-safe entity field metadata (no Drizzle imports).
 *
 * Shared by the CSV import/export registry (server) AND the generic
 * View/Edit drawer (client). `registry.ts` binds these slugs to tables +
 * access flags; this file holds only plain data so it is safe to bundle
 * into client components.
 */

export type FieldType = "string" | "int" | "number" | "money" | "bool" | "date" | "json";

export interface FieldDef {
  header: string;        // CSV column header / drawer label source
  field: string;         // Drizzle column property name
  type: FieldType;
  required?: boolean;    // import/edit: must be present & non-empty
  importable?: boolean;  // default true; false = export-only / read-only (e.g. id, computed)
  options?: string[];    // enum → render a <select> in edit mode
}

export interface EntityFields {
  slug: string;
  label: string;
  keyField: string;      // upsert match column (within a workspace)
  importable: boolean;   // CSV import supported
  doc?: boolean;         // transactional document → drawer links to detail/edit pages
  fields: FieldDef[];
}

const id: FieldDef = { header: "id", field: "id", type: "string", importable: false };

export const ENTITY_FIELDS: Record<string, EntityFields> = {
  customers: {
    slug: "customers", label: "Customer", keyField: "code", importable: true,
    fields: [
      id,
      { header: "code", field: "code", type: "string" },
      { header: "display_name", field: "displayName", type: "string", required: true },
      { header: "customer_type", field: "customerType", type: "string", options: ["business", "individual"] },
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
      { header: "status", field: "status", type: "string", options: ["active", "inactive"] },
    ],
  },
  vendors: {
    slug: "vendors", label: "Vendor", keyField: "code", importable: true,
    fields: [
      id,
      { header: "code", field: "code", type: "string" },
      { header: "display_name", field: "displayName", type: "string", required: true },
      { header: "vendor_type", field: "vendorType", type: "string", options: ["business", "individual"] },
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
      { header: "status", field: "status", type: "string", options: ["active", "inactive"] },
    ],
  },
  products: {
    slug: "products", label: "Item / Product", keyField: "sku", importable: true,
    fields: [
      id,
      { header: "sku", field: "sku", type: "string" },
      { header: "name", field: "name", type: "string", required: true },
      { header: "type", field: "type", type: "string", options: ["good", "service"] },
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
    slug: "tax-rates", label: "Tax Rate", keyField: "name", importable: true,
    fields: [
      id,
      { header: "name", field: "name", type: "string", required: true },
      { header: "rate_basis_points", field: "rateBasisPoints", type: "int", required: true },
      { header: "type", field: "type", type: "string", options: ["sales", "purchase", "both"] },
      { header: "is_default", field: "isDefault", type: "bool" },
      { header: "is_active", field: "isActive", type: "bool" },
    ],
  },
  "expense-categories": {
    slug: "expense-categories", label: "Expense Category", keyField: "name", importable: true,
    fields: [
      id,
      { header: "name", field: "name", type: "string", required: true },
      { header: "max_amount", field: "maxAmountMinor", type: "money" },
      { header: "receipt_required_above", field: "receiptRequiredAboveMinor", type: "money" },
      { header: "is_active", field: "isActive", type: "bool" },
    ],
  },
  "ledger-accounts": {
    slug: "ledger-accounts", label: "Account", keyField: "code", importable: true,
    fields: [
      id,
      { header: "code", field: "code", type: "string", required: true },
      { header: "name", field: "name", type: "string", required: true },
      { header: "type", field: "type", type: "string", required: true, options: ["asset", "liability", "equity", "income", "expense"] },
      { header: "is_active", field: "isActive", type: "bool" },
    ],
  },
  employees: {
    slug: "employees", label: "Employee", keyField: "employeeId", importable: true,
    fields: [
      id,
      { header: "employee_id", field: "employeeId", type: "string", required: true },
      { header: "name", field: "name", type: "string", required: true },
      { header: "email", field: "email", type: "string" },
      { header: "phone", field: "phone", type: "string" },
      { header: "department", field: "department", type: "string" },
      { header: "designation", field: "designation", type: "string" },
      { header: "employment_type", field: "employmentType", type: "string", options: ["full_time", "part_time", "contract", "intern"] },
      { header: "status", field: "status", type: "string", options: ["active", "inactive", "terminated"] },
    ],
  },
  warehouses: {
    slug: "warehouses", label: "Warehouse", keyField: "code", importable: true,
    fields: [
      id,
      { header: "code", field: "code", type: "string" },
      { header: "name", field: "name", type: "string", required: true },
      { header: "location", field: "location", type: "string" },
      { header: "is_default", field: "isDefault", type: "bool" },
      { header: "is_active", field: "isActive", type: "bool" },
    ],
  },

  // ── Transactional documents (CSV export-only; full edit via their forms) ──
  invoices: {
    slug: "invoices", label: "Invoice", keyField: "docNumber", importable: false, doc: true,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string", importable: false },
      { header: "status", field: "status", type: "string", importable: false },
      { header: "customer_id", field: "customerId", type: "string", importable: false },
      { header: "currency", field: "currency", type: "string", importable: false },
      { header: "subtotal", field: "subtotalMinor", type: "money", importable: false },
      { header: "tax", field: "taxMinor", type: "money", importable: false },
      { header: "total", field: "totalMinor", type: "money", importable: false },
      { header: "amount_paid", field: "amountPaidMinor", type: "money", importable: false },
      { header: "issue_date", field: "issueDate", type: "date", importable: false },
      { header: "due_date", field: "dueDate", type: "date", importable: false },
    ],
  },
  estimates: {
    slug: "estimates", label: "Quote / Estimate", keyField: "docNumber", importable: false, doc: true,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string", importable: false },
      { header: "status", field: "status", type: "string", importable: false },
      { header: "customer_id", field: "customerId", type: "string", importable: false },
      { header: "currency", field: "currency", type: "string", importable: false },
      { header: "total", field: "totalMinor", type: "money", importable: false },
      { header: "valid_until", field: "validUntil", type: "date", importable: false },
    ],
  },
  "sales-orders": {
    slug: "sales-orders", label: "Sales Order", keyField: "docNumber", importable: false, doc: true,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string", importable: false },
      { header: "status", field: "status", type: "string", importable: false },
      { header: "customer_id", field: "customerId", type: "string", importable: false },
      { header: "currency", field: "currency", type: "string", importable: false },
      { header: "total", field: "totalMinor", type: "money", importable: false },
    ],
  },
  "purchase-orders": {
    slug: "purchase-orders", label: "Purchase Order", keyField: "docNumber", importable: false, doc: true,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string", importable: false },
      { header: "status", field: "status", type: "string", importable: false },
      { header: "vendor_id", field: "vendorId", type: "string", importable: false },
      { header: "currency", field: "currency", type: "string", importable: false },
      { header: "subtotal", field: "subtotalMinor", type: "money", importable: false },
      { header: "tax", field: "taxMinor", type: "money", importable: false },
      { header: "total", field: "totalMinor", type: "money", importable: false },
      { header: "order_date", field: "orderDate", type: "date", importable: false },
      { header: "delivery_date", field: "expectedDate", type: "date", importable: false },
    ],
  },
  expenses: {
    slug: "expenses", label: "Expense", keyField: "docNumber", importable: false, doc: true,
    fields: [
      id,
      { header: "doc_number", field: "docNumber", type: "string", importable: false },
      { header: "status", field: "status", type: "string", importable: false },
      { header: "vendor_id", field: "vendorId", type: "string", importable: false },
      { header: "customer_id", field: "customerId", type: "string", importable: false },
      { header: "currency", field: "currency", type: "string", importable: false },
      { header: "amount", field: "amountMinor", type: "money", importable: false },
      { header: "invoice_number", field: "invoiceNumber", type: "string", importable: false },
      { header: "spent_at", field: "spentAt", type: "date", importable: false },
    ],
  },
};

export function getEntityFields(slug: string): EntityFields | undefined {
  return ENTITY_FIELDS[slug];
}
