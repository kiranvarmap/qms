import { z } from "zod";

// ── Primitives ────────────────────────────────────────────────────────
export const emailSchema    = z.string().email("Invalid email").toLowerCase().trim();
export const passwordSchema = z.string().min(8, "Minimum 8 characters").max(128);
export const uuidSchema     = z.string().uuid("Invalid ID");
export const nameSchema     = z.string().min(1, "Required").max(255).trim();
export const slugSchema     = z.string().regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, hyphens only");
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{3,8}$/, "Invalid hex color").optional();
export const urlSchema      = z.string().url("Invalid URL").optional();

// ── Auth ─────────────────────────────────────────────────────────────
export const registerSchema = z.object({
  name:     nameSchema,
  email:    emailSchema,
  password: passwordSchema,
});

export const signInSchema = z.object({
  email:    emailSchema,
  password: passwordSchema,
});

export const inviteUserSchema = z.object({
  email: emailSchema,
  name:  nameSchema.optional(),
  role:  z.enum(["admin", "manager", "user"]).default("user"),
});

// ── Workspaces ────────────────────────────────────────────────────────
export const createWorkspaceSchema = z.object({
  name:  nameSchema,
  color: hexColorSchema,
});

export const updateWorkspaceSchema = createWorkspaceSchema.partial();

// ── Boards ────────────────────────────────────────────────────────────
export const createBoardSchema = z.object({
  name:        nameSchema,
  workspaceId: uuidSchema,
  description: z.string().max(1000).trim().optional(),
});

// ── Items ─────────────────────────────────────────────────────────────
export const createItemSchema = z.object({
  name:    nameSchema,
  groupId: uuidSchema,
  boardId: uuidSchema,
});

// ── File upload ───────────────────────────────────────────────────────
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
]);

export const MAX_UPLOAD_BYTES  = 10 * 1024 * 1024;  // 10 MB
export const MAX_PDF_BYTES     = 20 * 1024 * 1024;  // 20 MB

// ── Forms ─────────────────────────────────────────────────────────────
export const createFormSchema = z.object({
  name:        nameSchema,
  boardId:     uuidSchema,
  workspaceId: uuidSchema,
  description: z.string().max(2000).trim().optional(),
  slug:        slugSchema.optional(),
});

// ── Time logs ─────────────────────────────────────────────────────────
export const timeLogQuerySchema = z.object({
  from:       z.string().datetime({ offset: true }).optional(),
  to:         z.string().datetime({ offset: true }).optional(),
  employeeId: z.string().optional(),
  limit:      z.coerce.number().int().min(1).max(500).default(100),
  offset:     z.coerce.number().int().min(0).default(0),
});

// ── Employees ─────────────────────────────────────────────────────────
export const createEmployeeSchema = z.object({
  name:       nameSchema,
  email:      emailSchema.optional(),
  department: z.string().max(255).trim().optional(),
  position:   z.string().max(255).trim().optional(),
});

// ── Document signing ──────────────────────────────────────────────────
export const createSignDocumentSchema = z.object({
  title:   nameSchema,
  message: z.string().max(2000).trim().optional(),
});

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 1 foundation (Plan §2)
// ════════════════════════════════════════════════════════════════════

const addressSchema = z
  .object({
    attention:  z.string().max(255).optional(),
    line1:      z.string().max(255).optional(),
    line2:      z.string().max(255).optional(),
    city:       z.string().max(120).optional(),
    state:      z.string().max(120).optional(),
    postalCode: z.string().max(40).optional(),
    country:    z.string().max(120).optional(),
    phone:      z.string().max(50).optional(),
    fax:        z.string().max(50).optional(),
  })
  .partial();

// ── Vendors ───────────────────────────────────────────────────────────
export const vendorContactSchema = z.object({
  salutation: z.string().max(20).trim().optional(),
  firstName:  z.string().max(120).trim().optional(),
  lastName:   z.string().max(120).trim().optional(),
  email:      z.string().max(255).trim().optional(),
  workPhone:  z.string().max(50).trim().optional(),
  mobile:     z.string().max(50).trim().optional(),
  isPrimary:  z.boolean().optional(),
});

export const vendorBankInputSchema = z.object({
  accountName:   z.string().max(255).trim().optional(),
  accountNumber: z.string().max(60).trim().optional(),
  bankName:      z.string().max(255).trim().optional(),
  branch:        z.string().max(255).trim().optional(),
  routing:       z.string().max(60).trim().optional(), // IFSC / SWIFT / ABA
});

export const createVendorSchema = z.object({
  workspaceId:              uuidSchema,
  // Identity (Zoho parity — mirrors customers)
  vendorType:               z.enum(["business", "individual"]).default("business"),
  salutation:               z.string().max(20).trim().optional(),
  firstName:                z.string().max(120).trim().optional(),
  lastName:                 z.string().max(120).trim().optional(),
  companyName:              z.string().max(255).trim().optional(),
  displayName:              z.string().min(1, "Display name is required").max(255).trim(),
  name:                     nameSchema.optional(),
  code:                     z.string().max(50).trim().optional(),
  email:                    emailSchema.optional(),
  workPhone:                z.string().max(50).trim().optional(),
  mobile:                   z.string().max(50).trim().optional(),
  phone:                    z.string().max(50).trim().optional(),
  vendorLanguage:           z.string().max(20).trim().optional(),
  // Other details — tax
  gstTreatment:             z.string().max(40).trim().optional(),
  placeOfSupply:            z.string().max(10).trim().optional(),
  gstin:                    z.string().max(20).trim().optional(),
  pan:                      z.string().max(20).trim().optional(),
  taxId:                    z.string().max(100).trim().optional(),
  taxPreference:            z.enum(["taxable", "tax_exempt"]).default("taxable"),
  currency:                 z.string().length(3).toUpperCase().optional(),
  openingBalance:           z.coerce.number().min(0).optional(),
  paymentTermsLabel:        z.string().max(40).trim().optional(),
  paymentTermsDays:         z.coerce.number().int().min(0).max(365).optional(),
  // Addresses
  address:                  addressSchema.optional(),
  billingAddress:           addressSchema.optional(),
  shippingAddress:          addressSchema.optional(),
  // Relations / meta
  contacts:                 z.array(vendorContactSchema).default([]),
  bankAccounts:             z.array(vendorBankInputSchema).default([]),
  customFields:             z.record(z.string(), z.any()).optional(),
  reportingTags:            z.record(z.string(), z.string()).optional(),
  documents:                z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  accountManagerEmployeeId: uuidSchema.optional(),
  notes:                    z.string().max(2000).trim().optional(),
});
export const updateVendorSchema = createVendorSchema
  .omit({ workspaceId: true })
  .partial()
  .extend({ status: z.enum(["active", "inactive"]).optional() });

// ── Customers ─────────────────────────────────────────────────────────
export const customerContactSchema = z.object({
  salutation: z.string().max(20).trim().optional(),
  firstName:  z.string().max(120).trim().optional(),
  lastName:   z.string().max(120).trim().optional(),
  email:      z.string().max(255).trim().optional(),
  workPhone:  z.string().max(50).trim().optional(),
  mobile:     z.string().max(50).trim().optional(),
  isPrimary:  z.boolean().optional(),
});

export const createCustomerSchema = z.object({
  workspaceId:              uuidSchema,
  // Identity
  customerType:             z.enum(["business", "individual"]).default("business"),
  salutation:               z.string().max(20).trim().optional(),
  firstName:                z.string().max(120).trim().optional(),
  lastName:                 z.string().max(120).trim().optional(),
  companyName:              z.string().max(255).trim().optional(),
  displayName:              z.string().min(1, "Display name is required").max(255).trim(),
  code:                     z.string().max(50).trim().optional(),
  email:                    emailSchema.optional(),
  workPhone:                z.string().max(50).trim().optional(),
  mobile:                   z.string().max(50).trim().optional(),
  customerLanguage:         z.string().max(20).trim().optional(),
  // Other details — tax
  gstTreatment:             z.string().max(40).trim().optional(),
  placeOfSupply:            z.string().max(10).trim().optional(),
  gstin:                    z.string().max(20).trim().optional(),
  pan:                      z.string().max(20).trim().optional(),
  taxId:                    z.string().max(100).trim().optional(),
  taxPreference:            z.enum(["taxable", "tax_exempt"]).default("taxable"),
  currency:                 z.string().length(3).toUpperCase().optional(),
  openingBalance:           z.coerce.number().min(0).optional(),
  paymentTermsLabel:        z.string().max(40).trim().optional(),
  paymentTermsDays:         z.coerce.number().int().min(0).max(365).optional(),
  enablePortal:             z.boolean().optional(),
  // Addresses
  billingAddress:           addressSchema.optional(),
  shippingAddress:          addressSchema.optional(),
  // Relations / meta
  contacts:                 z.array(customerContactSchema).default([]),
  customFields:             z.record(z.string(), z.any()).optional(),
  reportingTags:            z.record(z.string(), z.string()).optional(),
  documents:                z.array(z.object({ name: z.string(), url: z.string() })).optional(),
  accountManagerEmployeeId: uuidSchema.optional(),
  boardId:                  uuidSchema.optional(),
  notes:                    z.string().max(2000).trim().optional(),
});
export const updateCustomerSchema = createCustomerSchema
  .omit({ workspaceId: true })
  .partial()
  .extend({ status: z.enum(["active", "inactive"]).optional() });

// ── Tax rates ─────────────────────────────────────────────────────────
export const createTaxRateSchema = z.object({
  workspaceId:     uuidSchema,
  name:            z.string().min(1).max(100).trim(),
  // Basis points: 7.5% = 750. Max 100% (10000 bp).
  rateBasisPoints: z.coerce.number().int().min(0).max(10000),
  type:            z.enum(["sales", "purchase", "both"]).default("both"),
  isDefault:       z.boolean().optional(),
  isActive:        z.boolean().optional(),
});
export const updateTaxRateSchema = createTaxRateSchema.omit({ workspaceId: true }).partial();

// ── Approvals ─────────────────────────────────────────────────────────
export const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  comment:  z.string().max(2000).trim().optional(),
});

// ── Purchase Orders (Plan §5) ─────────────────────────────────────────
// `unitCost` is entered in MAJOR units (e.g. 12.34); the API converts to
// minor units via lib/money. Tax comes from the referenced tax_rate.
export const poLineSchema = z.object({
  productId:   uuidSchema.optional(),
  description: z.string().min(1, "Required").max(500).trim(),
  quantity:    z.coerce.number().positive("Must be > 0"),
  unitCost:    z.coerce.number().min(0),
  taxRateId:   uuidSchema.optional(),
});

export const createPurchaseOrderSchema = z.object({
  workspaceId:  uuidSchema,
  vendorId:     uuidSchema,
  expectedDate: z.string().datetime({ offset: true }).optional(), // Delivery Date
  orderDate:    z.string().datetime({ offset: true }).optional(), // Date
  notes:        z.string().max(2000).trim().optional(),
  boardId:      uuidSchema.optional(),
  groupId:      uuidSchema.optional(),
  itemId:       uuidSchema.optional(),
  lines:        z.array(poLineSchema).min(1, "At least one line item"),
  // Zoho PO parity
  reference:            z.string().max(255).trim().optional(),
  paymentTermsLabel:    z.string().max(40).trim().optional(),
  shipmentPreference:   z.string().max(255).trim().optional(),
  reverseCharge:        z.boolean().default(false),
  deliveryAddressType:  z.enum(["organization", "customer"]).default("organization"),
  deliveryCustomerId:   uuidSchema.optional(),
  deliveryAddress:      addressSchema.optional(),
  discountType:         z.enum(["percent", "amount"]).optional(),
  discountValue:        z.coerce.number().min(0).optional(),
  withholdingType:      z.enum(["tds", "tcs"]).nullable().optional(),
  withholdingTaxRateId: uuidSchema.nullable().optional(),
  adjustment:           z.coerce.number().optional(),
  termsConditions:      z.string().max(4000).trim().optional(),
  attachments:          z.array(z.object({ name: z.string(), url: z.string() })).optional(),
});

export const updatePurchaseOrderSchema = z.object({
  vendorId:     uuidSchema.optional(),
  expectedDate: z.string().datetime({ offset: true }).nullable().optional(),
  notes:        z.string().max(2000).trim().nullable().optional(),
  lines:        z.array(poLineSchema).min(1).optional(),
});

export const receiveGoodsSchema = z.object({
  notes:       z.string().max(2000).trim().optional(),
  warehouseId: uuidSchema.optional(),
  lines: z
    .array(z.object({ poLineItemId: uuidSchema, quantity: z.coerce.number().positive() }))
    .min(1, "At least one received line"),
});

// ── Inventory (Plan §4) ───────────────────────────────────────────────
// cost/price entered in MAJOR units; converted to minor via lib/money.
export const createProductSchema = z.object({
  workspaceId:    uuidSchema,
  name:           nameSchema,
  sku:            z.string().max(80).trim().optional(),
  type:           z.enum(["good", "service"]).default("good"),
  category:       z.string().max(120).trim().optional(),
  unit:           z.string().max(40).trim().optional(),
  description:    z.string().max(2000).trim().optional(),
  cost:           z.coerce.number().min(0).optional(),
  price:          z.coerce.number().min(0).optional(),
  reorderLevel:   z.coerce.number().min(0).optional(),
  trackInventory: z.boolean().optional(),
  // Product Management (BRD 0X): engineering lifecycle.
  lifecycleStatus: z.enum(["draft", "active", "obsolete"]).optional(),
  boardId:        uuidSchema.optional(),
});
export const updateProductSchema = createProductSchema
  .omit({ workspaceId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const createWarehouseSchema = z.object({
  workspaceId: uuidSchema,
  name:        nameSchema,
  code:        z.string().max(40).trim().optional(),
  location:    z.string().max(255).trim().optional(),
  workshopId:  uuidSchema.optional(),
  isDefault:   z.boolean().optional(),
});
export const updateWarehouseSchema = createWarehouseSchema
  .omit({ workspaceId: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export const stockAdjustmentSchema = z.object({
  workspaceId: uuidSchema,
  productId:   uuidSchema,
  warehouseId: uuidSchema,
  // Signed delta; positive adds, negative removes. Non-zero.
  quantity:    z.coerce.number().refine((n) => n !== 0, "Must be non-zero"),
  note:        z.string().max(500).trim().optional(),
});

export const stockTransferSchema = z.object({
  workspaceId:     uuidSchema,
  productId:       uuidSchema,
  fromWarehouseId: uuidSchema,
  toWarehouseId:   uuidSchema,
  quantity:        z.coerce.number().positive(),
  note:            z.string().max(500).trim().optional(),
}).refine((d) => d.fromWarehouseId !== d.toWarehouseId, {
  message: "Source and destination must differ",
  path: ["toWarehouseId"],
});

// ── Estimates (Plan §6.1) ─────────────────────────────────────────────
// `unitPrice` entered in MAJOR units; converted to minor via lib/money.
export const estimateLineSchema = z.object({
  productId:   uuidSchema.optional(),
  description: z.string().min(1, "Required").max(500).trim(),
  quantity:    z.coerce.number().positive("Must be > 0"),
  unitPrice:   z.coerce.number().min(0),
  taxRateId:   uuidSchema.optional(),
});

export const estimateAdjustmentsSchema = {
  reference:            z.string().max(100).trim().optional(),
  subject:              z.string().max(500).trim().optional(),
  salespersonEmployeeId: uuidSchema.optional(),
  projectId:            uuidSchema.optional(),
  discountType:         z.enum(["percent", "amount"]).optional(),
  discountValue:        z.coerce.number().min(0).optional(),
  withholdingType:      z.enum(["tds", "tcs"]).nullable().optional(),
  withholdingTaxRateId: uuidSchema.nullable().optional(),
  adjustment:           z.coerce.number().optional(),
  roundOff:             z.coerce.number().optional(),
  customerNotes:        z.string().max(2000).trim().optional(),
  termsConditions:      z.string().max(4000).trim().optional(),
  attachments:          z.array(z.object({ name: z.string(), url: z.string() })).optional(),
};

export const createEstimateSchema = z.object({
  workspaceId: uuidSchema,
  customerId:  uuidSchema,
  validUntil:  z.string().datetime({ offset: true }).optional(),
  notes:       z.string().max(2000).trim().optional(),
  boardId:     uuidSchema.optional(),
  groupId:     uuidSchema.optional(),
  itemId:      uuidSchema.optional(),
  lines:       z.array(estimateLineSchema).min(1, "At least one line item"),
  ...estimateAdjustmentsSchema,
});

export const updateEstimateSchema = z.object({
  customerId: uuidSchema.optional(),
  validUntil: z.string().datetime({ offset: true }).nullable().optional(),
  notes:      z.string().max(2000).trim().nullable().optional(),
  lines:      z.array(estimateLineSchema).min(1).optional(),
});

export const convertEstimateSchema = z.object({
  target: z.enum(["sales_order", "invoice"]),
});

// ── Sales Orders & Fulfillment (Plan §6.2) ────────────────────────────
export const salesOrderLineSchema = z.object({
  productId:   uuidSchema.optional(),
  description: z.string().min(1, "Required").max(500).trim(),
  quantity:    z.coerce.number().positive("Must be > 0"),
  unitPrice:   z.coerce.number().min(0),
  taxRateId:   uuidSchema.optional(),
});

export const createSalesOrderSchema = z.object({
  workspaceId: uuidSchema,
  customerId:  uuidSchema,
  warehouseId: uuidSchema.optional(),
  notes:       z.string().max(2000).trim().optional(),
  boardId:     uuidSchema.optional(),
  groupId:     uuidSchema.optional(),
  itemId:      uuidSchema.optional(),
  lines:       z.array(salesOrderLineSchema).min(1, "At least one line item"),
  ...estimateAdjustmentsSchema,
});

export const updateSalesOrderSchema = z.object({
  customerId:  uuidSchema.optional(),
  warehouseId: uuidSchema.nullable().optional(),
  notes:       z.string().max(2000).trim().nullable().optional(),
  lines:       z.array(salesOrderLineSchema).min(1).optional(),
});

export const createShipmentSchema = z.object({
  salesOrderId: uuidSchema,
  carrier:      z.string().max(120).trim().optional(),
  tracking:     z.string().max(120).trim().optional(),
  notes:        z.string().max(2000).trim().optional(),
  lines: z
    .array(z.object({ salesOrderLineId: uuidSchema, quantity: z.coerce.number().positive(), warehouseId: uuidSchema.optional() }))
    .min(1, "At least one line to ship"),
});

// ── Invoicing (Plan §6) — manual payments only ────────────────────────
export const invoiceLineSchema = z.object({
  productId:        uuidSchema.optional(),
  timeLogId:        uuidSchema.optional(),
  salesOrderLineId: uuidSchema.optional(),
  description:      z.string().min(1, "Required").max(500).trim(),
  quantity:         z.coerce.number().positive("Must be > 0"),
  unitPrice:        z.coerce.number().min(0),
  taxRateId:        uuidSchema.optional(),
});

export const createInvoiceSchema = z.object({
  workspaceId: uuidSchema,
  customerId:  uuidSchema,
  issueDate:   z.string().datetime({ offset: true }).optional(),
  dueDate:     z.string().datetime({ offset: true }).optional(),
  notes:       z.string().max(2000).trim().optional(),
  boardId:     uuidSchema.optional(),
  groupId:     uuidSchema.optional(),
  itemId:      uuidSchema.optional(),
  lines:       z.array(invoiceLineSchema).min(1, "At least one line item"),
  ...estimateAdjustmentsSchema,
});

export const updateInvoiceSchema = z.object({
  customerId: uuidSchema.optional(),
  dueDate:    z.string().datetime({ offset: true }).nullable().optional(),
  notes:      z.string().max(2000).trim().nullable().optional(),
  lines:      z.array(invoiceLineSchema).min(1).optional(),
});

// ── Customer Portal (Plan §6.5) ───────────────────────────────────────
export const createPortalContactSchema = z.object({
  workspaceId: uuidSchema,
  customerId:  uuidSchema,
  name:        nameSchema,
  email:       emailSchema,
  password:    passwordSchema,
});

export const portalLoginSchema = z.object({
  email:    emailSchema,
  password: z.string().min(1, "Required"),
});

// ── Expenses (Plan §7) — manual reimbursement ─────────────────────────
export const createExpenseCategorySchema = z.object({
  workspaceId: uuidSchema,
  name:        z.string().min(1).max(120).trim(),
});

export const createExpenseSchema = z.object({
  workspaceId:     uuidSchema,
  employeeId:      uuidSchema.optional(), // defaults to the caller's employee
  categoryId:      uuidSchema.optional(),
  vendorId:        uuidSchema.optional(),
  amount:          z.coerce.number().min(0).optional(), // major units (computed for mileage)
  currency:        z.string().length(3).toUpperCase().optional(),
  spentAt:         z.string().datetime({ offset: true }).optional(),
  description:     z.string().max(2000).trim().optional(),
  receiptFilePath: z.string().max(1000).optional(),
  boardId:         uuidSchema.optional(),
  groupId:         uuidSchema.optional(),
  itemId:          uuidSchema.optional(),
  // Full BRD: mileage/per-diem, cost-centre, billable re-invoice.
  kind:            z.enum(["general", "mileage", "per_diem"]).default("general"),
  mileageDistance: z.coerce.number().min(0).optional(),
  mileageRate:     z.coerce.number().min(0).optional(),
  costCentre:      z.string().max(120).trim().optional(),
  billable:        z.boolean().default(false),
  customerId:      uuidSchema.optional(),
  // Zoho "Record Expense" parity
  expenseAccountId:     uuidSchema.optional(),
  paidThroughAccountId: uuidSchema.optional(),
  expenseType:          z.enum(["goods", "services"]).default("goods"),
  sacCode:              z.string().max(60).trim().optional(),
  gstTreatment:         z.string().max(40).trim().optional(),
  sourceOfSupply:       z.string().max(10).trim().optional(),
  destinationOfSupply:  z.string().max(10).trim().optional(),
  reverseCharge:        z.boolean().default(false),
  taxRateId:            uuidSchema.optional(),
  taxInclusive:         z.boolean().default(false),
  invoiceNumber:        z.string().max(120).trim().optional(),
  reportingTags:        z.record(z.string(), z.string()).optional(),
});

// Expenses full BRD — policy, advances, corporate card.
export const expensePolicySchema = z.object({
  maxAmount:            z.coerce.number().min(0).default(0),
  receiptRequiredAbove: z.coerce.number().min(0).default(0),
});
export const createAdvanceSchema = z.object({
  workspaceId: uuidSchema,
  employeeId:  uuidSchema,
  amount:      z.coerce.number().positive("Must be > 0"),
  note:        z.string().max(255).trim().optional(),
});
export const advanceDecisionSchema = z.object({ decision: z.enum(["approved", "settled"]), settledAmount: z.coerce.number().min(0).optional() });
export const importCardTxnsSchema = z.object({
  workspaceId:  uuidSchema,
  transactions: z.array(z.object({
    postedDate:  z.string().datetime({ offset: true }).optional(),
    description: z.string().max(255).trim().optional(),
    amount:      z.coerce.number(),
    last4:       z.string().max(4).optional(),
  })).default([]),
});
export const matchCardTxnSchema = z.object({ expenseId: uuidSchema });

export const updateExpenseSchema = z.object({
  categoryId:      uuidSchema.nullable().optional(),
  vendorId:        uuidSchema.nullable().optional(),
  amount:          z.coerce.number().positive().optional(),
  spentAt:         z.string().datetime({ offset: true }).optional(),
  description:     z.string().max(2000).trim().nullable().optional(),
  receiptFilePath: z.string().max(1000).nullable().optional(),
});

export const reimburseExpenseSchema = z.object({
  method:    z.enum(["cash", "cheque", "bank_transfer", "other"]).default("bank_transfer"),
  reference: z.string().max(120).trim().optional(),
});

// ── HR + Leave (Plan §8) ──────────────────────────────────────────────
export const createDepartmentSchema = z.object({
  workspaceId:    uuidSchema,
  name:           z.string().min(1).max(120).trim(),
  headEmployeeId: uuidSchema.optional(),
});

export const createLeaveTypeSchema = z.object({
  workspaceId: uuidSchema,
  name:        z.string().min(1).max(120).trim(),
  defaultDays: z.coerce.number().min(0).default(0),
  isPaid:      z.boolean().default(true),
});

export const createLeaveRequestSchema = z.object({
  workspaceId:        uuidSchema,
  employeeId:         uuidSchema.optional(), // defaults to caller's employee
  leaveTypeId:        uuidSchema,
  startDate:          z.string().datetime({ offset: true }),
  endDate:            z.string().datetime({ offset: true }),
  days:               z.coerce.number().positive("Must be > 0"),
  reason:             z.string().max(2000).trim().optional(),
  coveringEmployeeId: uuidSchema.optional(),
});

export const updateEmployeeHrSchema = z.object({
  managerEmployeeId: uuidSchema.nullable().optional(),
  departmentId:      uuidSchema.nullable().optional(),
  employmentType:    z.enum(["full_time", "part_time", "contract", "intern"]).nullable().optional(),
  designation:       z.string().max(100).trim().nullable().optional(),
});

// ── Training & Certification (Plan §9) ────────────────────────────────
export const createCourseSchema = z.object({
  workspaceId: uuidSchema,
  title:       nameSchema,
  description: z.string().max(4000).trim().optional(),
  category:    z.string().max(120).trim().optional(),
});
export const updateCourseSchema = z.object({
  title:       nameSchema.optional(),
  description: z.string().max(4000).trim().nullable().optional(),
  category:    z.string().max(120).trim().nullable().optional(),
  isPublished: z.boolean().optional(),
});

export const createLessonSchema = z.object({
  title:       z.string().min(1).max(255).trim(),
  contentType: z.enum(["text", "video", "sop", "file"]).default("text"),
  contentText: z.string().max(20000).optional(),
  contentUrl:  z.string().max(2000).optional(),
  sopId:       uuidSchema.optional(),
});

export const createEnrollmentSchema = z.object({
  workspaceId: uuidSchema,
  courseId:    uuidSchema,
  employeeId:  uuidSchema,
  dueDate:     z.string().datetime({ offset: true }).optional(),
});

export const lessonProgressSchema = z.object({
  lessonId: uuidSchema,
});

export const createCertificationSchema = z.object({
  workspaceId:      uuidSchema,
  name:             z.string().min(1).max(255).trim(),
  description:      z.string().max(2000).trim().optional(),
  validityMonths:   z.coerce.number().int().min(0).default(0),
  requiresCourseId: uuidSchema.optional(),
});

export const recordPaymentSchema = z.object({
  // Amount in MAJOR units; converted to minor server-side.
  amount:       z.coerce.number().positive("Must be > 0"),
  method:       z.enum(["cash", "cheque", "bank_transfer", "other"]).default("other"),
  reference:    z.string().max(120).trim().optional(),
  receivedDate: z.string().datetime({ offset: true }).optional(),
  note:         z.string().max(500).trim().optional(),
});

// ── Product Management — engineering layer (BRD 0X) ───────────────────
export const bomLineSchema = z.object({
  componentProductId: uuidSchema.optional(),
  description:        z.string().max(255).trim().optional(),
  quantity:          z.coerce.number().positive("Must be > 0").default(1),
  unit:              z.string().max(40).trim().default("unit"),
  scrapPct:          z.coerce.number().min(0).max(100).default(0),
});

export const createBomSchema = z.object({
  version: z.string().max(40).trim().default("v1"),
  name:    z.string().max(255).trim().optional(),
  status:  z.enum(["draft", "active", "archived"]).default("draft"),
  notes:   z.string().max(2000).trim().optional(),
  lines:   z.array(bomLineSchema).default([]),
});

export const createRevisionSchema = z.object({
  revision:      z.string().min(1, "Required").max(40).trim(),
  changeSummary: z.string().max(2000).trim().optional(),
  release:       z.boolean().default(false),
});

export const upsertSpecSchema = z.object({
  key:   z.string().min(1, "Required").max(120).trim(),
  value: z.string().max(500).trim().optional(),
  unit:  z.string().max(40).trim().optional(),
});

export const createEcrSchema = z.object({
  workspaceId: uuidSchema,
  productId:   uuidSchema.optional(),
  title:       z.string().min(1, "Required").max(255).trim(),
  description: z.string().max(4000).trim().optional(),
  priority:    z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  submit:      z.boolean().default(false),
});

export const ecrDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "implemented"]),
  notes:    z.string().max(2000).trim().optional(),
});

// ── Production / Manufacturing (BRD 11) ───────────────────────────────
export const createWorkOrderSchema = z.object({
  workspaceId: uuidSchema,
  productId:   uuidSchema,
  bomId:       uuidSchema.optional(),
  warehouseId: uuidSchema.optional(),
  qtyPlanned:  z.coerce.number().positive("Must be > 0").default(1),
  dueDate:     z.string().datetime({ offset: true }).optional(),
  boardId:     uuidSchema.optional(),
  notes:       z.string().max(2000).trim().optional(),
  // ── Production Planning (BRD 13) ──
  priority:            z.enum(["low", "normal", "high", "urgent"]).optional(),
  processTemplateId:   uuidSchema.optional(),
  salesOrderId:        uuidSchema.optional(),
  customerId:          uuidSchema.optional(),
  specialInstructions: z.string().max(4000).trim().optional(),
});

export const completeWorkOrderSchema = z.object({
  qtyProduced: z.coerce.number().min(0).default(0),
  qtyScrapped: z.coerce.number().min(0).default(0),
  warehouseId: uuidSchema.optional(),
});

// ── Maintenance (BRD 12) ──────────────────────────────────────────────
export const createAssetSchema = z.object({
  workspaceId:   uuidSchema,
  name:          nameSchema,
  code:          z.string().max(60).trim().optional(),
  type:          z.string().max(120).trim().optional(),
  parentAssetId: uuidSchema.optional(),
  location:      z.string().max(255).trim().optional(),
  criticality:   z.enum(["low", "medium", "high"]).default("medium"),
  notes:         z.string().max(2000).trim().optional(),
});

export const assetStatusSchema = z.object({
  status: z.enum(["up", "down", "maintenance", "retired"]),
});

export const createMaintenanceOrderSchema = z.object({
  workspaceId:   uuidSchema,
  assetId:       uuidSchema,
  type:          z.enum(["corrective", "preventive"]).default("corrective"),
  priority:      z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  fault:         z.string().max(2000).trim().optional(),
  scheduledDate: z.string().datetime({ offset: true }).optional(),
});

export const maintenancePartSchema = z.object({
  partProductId: uuidSchema.optional(),
  description:   z.string().max(255).trim().optional(),
  qtyUsed:       z.coerce.number().positive("Must be > 0").default(1),
  warehouseId:   uuidSchema.optional(),
});

export const completeMaintenanceSchema = z.object({
  downtimeHours: z.coerce.number().min(0).default(0),
  parts:         z.array(maintenancePartSchema).default([]),
});

// ── Safety / EHS (BRD 13) ─────────────────────────────────────────────
export const createIncidentSchema = z.object({
  workspaceId: uuidSchema,
  type:        z.enum(["injury", "near_miss", "property", "environmental"]).default("near_miss"),
  severity:    z.enum(["low", "medium", "high", "critical"]).default("low"),
  occurredAt:  z.string().datetime({ offset: true }).optional(),
  location:    z.string().max(255).trim().optional(),
  description: z.string().max(4000).trim().optional(),
  assetId:     uuidSchema.optional(),
});

export const investigateIncidentSchema = z.object({
  rootCause: z.string().max(4000).trim().optional(),
});

export const addSafetyActionSchema = z.object({
  description: z.string().min(1, "Required").max(2000).trim(),
  dueDate:     z.string().datetime({ offset: true }).optional(),
});

export const safetyActionStatusSchema = z.object({
  actionId: uuidSchema,
  status:   z.enum(["open", "done"]),
});

// ── Inventory full BRD ────────────────────────────────────────────────
export const createLocationSchema = z.object({
  workspaceId:      uuidSchema,
  warehouseId:      uuidSchema,
  code:             z.string().min(1, "Required").max(60).trim(),
  name:             z.string().max(255).trim().optional(),
  kind:             z.enum(["zone", "aisle", "rack", "shelf", "bin"]).default("bin"),
  parentLocationId: uuidSchema.optional(),
});

export const createLotSchema = z.object({
  lotNumber:         z.string().min(1, "Required").max(120).trim(),
  supplierLotNumber: z.string().max(120).trim().optional(),
  mfgDate:           z.string().datetime({ offset: true }).optional(),
  expiryDate:        z.string().datetime({ offset: true }).optional(),
});

export const createSerialSchema = z.object({
  serialNumber: z.string().min(1, "Required").max(120).trim(),
  lotId:        uuidSchema.optional(),
  warehouseId:  uuidSchema.optional(),
});

export const stockStatusMoveSchema = z.object({
  workspaceId: uuidSchema,
  productId:   uuidSchema,
  warehouseId: uuidSchema,
  move:        z.enum(["damage", "quarantine", "quarantine_release", "scrap"]),
  quantity:    z.coerce.number().positive("Must be > 0"),
  from:        z.enum(["on_hand", "quarantine", "damaged"]).optional(),
  note:        z.string().max(500).trim().optional(),
});

export const createCycleCountSchema = z.object({
  workspaceId: uuidSchema,
  warehouseId: uuidSchema.optional(),
  note:        z.string().max(500).trim().optional(),
});

export const enterCountsSchema = z.object({
  counts: z.array(z.object({ lineId: uuidSchema, countedQty: z.coerce.number().min(0) })).default([]),
});

// ── Invoicing & Books full BRD ────────────────────────────────────────
export const apBillLineSchema = z.object({
  description: z.string().min(1, "Required").max(500).trim(),
  quantity:    z.coerce.number().positive().default(1),
  unitPrice:   z.coerce.number().min(0).default(0),
});
export const createApBillSchema = z.object({
  workspaceId:     uuidSchema,
  vendorId:        uuidSchema,
  purchaseOrderId: uuidSchema.optional(),
  dueDate:         z.string().datetime({ offset: true }).optional(),
  currency:        z.string().length(3).toUpperCase().default("USD"),
  notes:           z.string().max(2000).trim().optional(),
  lines:           z.array(apBillLineSchema).default([]),
});
export const createCreditNoteSchema = z.object({
  workspaceId: uuidSchema,
  invoiceId:   uuidSchema.optional(),
  customerId:  uuidSchema.optional(),
  amount:      z.coerce.number().positive("Must be > 0"),
  reason:      z.string().max(255).trim().optional(),
});
export const writeOffSchema = z.object({ amount: z.coerce.number().positive("Must be > 0") });
export const createAccountSchema = z.object({
  workspaceId: uuidSchema,
  code:        z.string().min(1, "Required").max(20).trim(),
  name:        z.string().min(1, "Required").max(255).trim(),
  type:        z.enum(["asset", "liability", "equity", "income", "expense"]),
});
export const journalLineSchema = z.object({
  accountId: uuidSchema,
  debit:     z.coerce.number().min(0).default(0),
  credit:    z.coerce.number().min(0).default(0),
  memo:      z.string().max(255).trim().optional(),
});
export const createJournalSchema = z.object({
  workspaceId: uuidSchema,
  entryDate:   z.string().datetime({ offset: true }).optional(),
  memo:        z.string().max(500).trim().optional(),
  post:        z.boolean().default(false),
  lines:       z.array(journalLineSchema).min(2, "At least two lines"),
});

// ── Sales full BRD ────────────────────────────────────────────────────
export const createPriceListSchema = z.object({
  workspaceId: uuidSchema,
  name:        z.string().min(1, "Required").max(255).trim(),
  currency:    z.string().length(3).toUpperCase().default("USD"),
  isDefault:   z.boolean().default(false),
});
export const priceListItemSchema = z.object({
  productId: uuidSchema,
  unitPrice: z.coerce.number().min(0).default(0),
});
export const customerSalesSettingsSchema = z.object({
  creditLimit: z.coerce.number().min(0).optional(),
  priceListId: uuidSchema.nullable().optional(),
});
export const salesReturnLineSchema = z.object({
  productId:   uuidSchema.optional(),
  description: z.string().max(500).trim().optional(),
  quantity:    z.coerce.number().positive("Must be > 0").default(1),
  unitPrice:   z.coerce.number().min(0).default(0),
});
export const createSalesReturnSchema = z.object({
  workspaceId:  uuidSchema,
  salesOrderId: uuidSchema.optional(),
  customerId:   uuidSchema.optional(),
  warehouseId:  uuidSchema.optional(),
  reason:       z.string().max(255).trim().optional(),
  restock:      z.boolean().default(true),
  lines:        z.array(salesReturnLineSchema).default([]),
});
export const recurringOrderSchema = z.object({
  workspaceId: uuidSchema,
  customerId:  uuidSchema,
  name:        z.string().min(1, "Required").max(255).trim(),
  cadence:     z.enum(["weekly", "monthly", "quarterly"]).default("monthly"),
  lines:       z.array(z.object({ productId: uuidSchema.optional(), description: z.string().max(500).trim(), quantity: z.coerce.number().positive().default(1), unitPrice: z.coerce.number().min(0).default(0) })).default([]),
});

// ── Purchasing full BRD ───────────────────────────────────────────────
export const requisitionLineSchema = z.object({
  productId:   uuidSchema.optional(),
  description: z.string().min(1, "Required").max(500).trim(),
  quantity:    z.coerce.number().positive("Must be > 0").default(1),
  estUnitCost: z.coerce.number().min(0).default(0),
});
export const createRequisitionSchema = z.object({
  workspaceId: uuidSchema,
  vendorId:    uuidSchema.optional(),
  neededBy:    z.string().datetime({ offset: true }).optional(),
  notes:       z.string().max(2000).trim().optional(),
  submit:      z.boolean().default(false),
  lines:       z.array(requisitionLineSchema).default([]),
});
export const requisitionDecisionSchema = z.object({ decision: z.enum(["approved", "rejected"]) });

export const landedCostSchema = z.object({
  costType: z.string().max(40).trim().default("freight"),
  amount:   z.coerce.number().min(0).default(0),
  note:     z.string().max(255).trim().optional(),
});

export const purchaseReturnLineSchema = z.object({
  productId:   uuidSchema.optional(),
  description: z.string().max(500).trim().optional(),
  quantity:    z.coerce.number().positive("Must be > 0").default(1),
  unitCost:    z.coerce.number().min(0).default(0),
});
export const createPurchaseReturnSchema = z.object({
  workspaceId:     uuidSchema,
  purchaseOrderId: uuidSchema.optional(),
  vendorId:        uuidSchema.optional(),
  warehouseId:     uuidSchema.optional(),
  reason:          z.string().max(255).trim().optional(),
  lines:           z.array(purchaseReturnLineSchema).default([]),
});

// ── Vendor full BRD ───────────────────────────────────────────────────
export const vendorAddressSchema = z.object({
  kind:       z.enum(["billing", "shipping", "remit"]).default("billing"),
  line1:      z.string().max(255).trim().optional(),
  line2:      z.string().max(255).trim().optional(),
  city:       z.string().max(120).trim().optional(),
  state:      z.string().max(120).trim().optional(),
  country:    z.string().max(2).optional(),
  postalCode: z.string().max(20).trim().optional(),
});

export const vendorDocumentSchema = z.object({
  docType:     z.string().min(1, "Required").max(120).trim(),
  number:      z.string().max(120).trim().optional(),
  issuedDate:  z.string().datetime({ offset: true }).optional(),
  expiryDate:  z.string().datetime({ offset: true }).optional(),
  fileUrl:     z.string().max(2000).optional(),
  isMandatory: z.boolean().default(false),
});

export const vendorBankAccountSchema = z.object({
  accountName:   z.string().max(255).trim().optional(),
  accountNumber: z.string().max(60).trim().optional(),
  bankName:      z.string().max(255).trim().optional(),
  branch:        z.string().max(255).trim().optional(),
  routing:       z.string().max(60).trim().optional(),
});

export const vendorPerformanceSchema = z.object({
  periodStart:      z.string().datetime({ offset: true }).optional(),
  periodEnd:        z.string().datetime({ offset: true }).optional(),
  onTimePct:        z.coerce.number().min(0).max(100).default(0),
  qualityRejectPct: z.coerce.number().min(0).max(100).default(0),
  priceVariancePct: z.coerce.number().default(0),
  rating:           z.coerce.number().min(0).max(5).default(0),
  note:             z.string().max(1000).trim().optional(),
});

export const vendorItemSchema = z.object({
  productId:    uuidSchema.optional(),
  vendorSku:    z.string().max(120).trim().optional(),
  description:  z.string().max(255).trim().optional(),
  unitPrice:    z.coerce.number().min(0).default(0),
  leadTimeDays: z.coerce.number().int().min(0).default(0),
});

export const setPreferredSchema = z.object({ isPreferred: z.boolean() });

// ── Localization (BRD 00 §12) ─────────────────────────────────────────
export const updateLocalizationSchema = z.object({
  country:  z.string().length(2).toUpperCase(),
  currency: z.string().length(3).toUpperCase().optional(),
  locale:   z.string().max(10).optional(),
  timezone: z.string().max(64).optional(),
});

// ── Production Planning (BRD 13) ──────────────────────────────────────
export const createWorkCenterSchema = z.object({
  workspaceId:         uuidSchema,
  name:                nameSchema,
  code:                z.string().max(60).trim().optional(),
  type:                z.enum(["machine", "manual", "hybrid"]).default("machine"),
  department:          z.string().max(120).trim().optional(),
  location:            z.string().max(255).trim().optional(),
  capacityHoursPerDay: z.coerce.number().positive().default(8),
  notes:               z.string().max(2000).trim().optional(),
});
export const updateWorkCenterSchema = createWorkCenterSchema.partial().omit({ workspaceId: true });

export const workCenterMachineSchema = z.object({
  assetId:      uuidSchema.optional(),
  name:         nameSchema,
  capacityPct:  z.coerce.number().min(0).max(100).default(100),
  setupMinutes: z.coerce.number().int().min(0).default(0),
  notes:        z.string().max(1000).trim().optional(),
});

export const workCenterShiftSchema = z.object({
  dayOfWeek:    z.coerce.number().int().min(0).max(6),
  startTime:    z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").default("08:00"),
  endTime:      z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").default("17:00"),
  breakMinutes: z.coerce.number().int().min(0).default(0),
});
export const workCenterShiftsSchema = z.object({ shifts: z.array(workCenterShiftSchema) });
export const workCenterMachinesSchema = z.object({ machines: z.array(workCenterMachineSchema) });

export const createProductionSkillSchema = z.object({
  workspaceId: uuidSchema,
  name:        nameSchema,
  description: z.string().max(1000).trim().optional(),
});

export const employeeSkillSchema = z.object({
  skillId:        uuidSchema,
  level:          z.enum(["trainee", "qualified", "expert"]).default("qualified"),
  certifiedUntil: z.string().datetime({ offset: true }).optional(),
});
export const employeeSkillsSchema = z.object({ workspaceId: uuidSchema, skills: z.array(employeeSkillSchema) });

export const employeeShiftSchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").default("08:00"),
  endTime:   z.string().regex(/^\d{2}:\d{2}$/, "HH:MM").default("17:00"),
});
export const employeeShiftsSchema = z.object({ shifts: z.array(employeeShiftSchema) });

export const createProcessTemplateSchema = z.object({
  workspaceId: uuidSchema,
  productId:   uuidSchema,
  version:     z.string().max(40).trim().default("v1"),
  name:        z.string().max(255).trim().optional(),
  notes:       z.string().max(2000).trim().optional(),
});
export const updateProcessTemplateSchema = z.object({
  version: z.string().max(40).trim().optional(),
  name:    z.string().max(255).trim().optional(),
  status:  z.enum(["draft", "active", "archived"]).optional(),
  notes:   z.string().max(2000).trim().optional(),
});

export const stageSkillSchema = z.object({
  skillId:           uuidSchema,
  requiredHeadcount: z.coerce.number().int().min(1).default(1),
  minLevel:          z.enum(["trainee", "qualified", "expert"]).default("qualified"),
});

export const stageMaterialSchema = z.object({
  componentProductId:  uuidSchema.optional(),
  description:         z.string().max(255).trim().optional(),
  qtyPer:              z.coerce.number().min(0).default(1),
  unit:                z.string().max(40).trim().default("unit"),
  wastagePct:          z.coerce.number().min(0).default(0),
  substituteAllowed:   z.boolean().default(false),
  criticalItem:        z.boolean().default(false),
  requiredBeforeStart: z.boolean().default(true),
});

export const processStageSchema = z.object({
  name:                 nameSchema,
  sequence:             z.coerce.number().int().min(0).default(0),
  parentStageId:        uuidSchema.optional(),
  dependsOnStageId:     uuidSchema.optional(),
  durationMinutes:      z.coerce.number().int().min(0).default(60),
  setupMinutes:         z.coerce.number().int().min(0).default(0),
  bufferMinutes:        z.coerce.number().int().min(0).default(0),
  workCenterId:         uuidSchema.optional(),
  requiredSkillId:      uuidSchema.optional(),
  requiredHeadcount:    z.coerce.number().int().min(0).default(1),
  qaCheckpointRequired: z.boolean().default(false),
  scrapPct:             z.coerce.number().min(0).default(0),
  outputQty:            z.coerce.number().min(0).default(1),
  instructions:         z.string().max(4000).trim().optional(),
  notes:                z.string().max(2000).trim().optional(),
  materials:            z.array(stageMaterialSchema).optional(),
  skills:               z.array(stageSkillSchema).optional(),
});
export const updateProcessStageSchema = processStageSchema.partial();

export const simulateSchema = z.object({
  extraHeadcount:     z.record(z.string(), z.coerce.number()).optional(),
  expeditePO:         z.record(z.string(), z.string()).optional(),
  moveJobAside:       z.array(uuidSchema).optional(),
  hoursPerDay:        z.coerce.number().positive().optional(),
  requestedStartDate: z.string().datetime({ offset: true }).optional(),
});

export const reserveMaterialsSchema = z.object({
  warehouseId: uuidSchema.optional(),
});

export const setPrioritySchema = z.object({
  priority: z.enum(["low", "normal", "high", "urgent"]),
  confirm:  z.boolean().default(false),
});
