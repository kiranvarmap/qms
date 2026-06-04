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
    line1:      z.string().max(255).optional(),
    line2:      z.string().max(255).optional(),
    city:       z.string().max(120).optional(),
    state:      z.string().max(120).optional(),
    postalCode: z.string().max(40).optional(),
    country:    z.string().max(120).optional(),
  })
  .partial();

// ── Vendors ───────────────────────────────────────────────────────────
export const createVendorSchema = z.object({
  workspaceId:              uuidSchema,
  name:                     nameSchema,
  code:                     z.string().max(50).trim().optional(),
  email:                    emailSchema.optional(),
  phone:                    z.string().max(50).trim().optional(),
  taxId:                    z.string().max(100).trim().optional(),
  address:                  addressSchema.optional(),
  paymentTermsDays:         z.coerce.number().int().min(0).max(365).optional(),
  accountManagerEmployeeId: uuidSchema.optional(),
  notes:                    z.string().max(2000).trim().optional(),
});
export const updateVendorSchema = createVendorSchema
  .omit({ workspaceId: true })
  .partial()
  .extend({ status: z.enum(["active", "inactive"]).optional() });

// ── Customers ─────────────────────────────────────────────────────────
export const createCustomerSchema = z.object({
  workspaceId:              uuidSchema,
  name:                     nameSchema,
  code:                     z.string().max(50).trim().optional(),
  email:                    emailSchema.optional(),
  phone:                    z.string().max(50).trim().optional(),
  taxId:                    z.string().max(100).trim().optional(),
  billingAddress:           addressSchema.optional(),
  shippingAddress:          addressSchema.optional(),
  paymentTermsDays:         z.coerce.number().int().min(0).max(365).optional(),
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
  expectedDate: z.string().datetime({ offset: true }).optional(),
  notes:        z.string().max(2000).trim().optional(),
  boardId:      uuidSchema.optional(),
  groupId:      uuidSchema.optional(),
  itemId:       uuidSchema.optional(),
  lines:        z.array(poLineSchema).min(1, "At least one line item"),
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

export const createEstimateSchema = z.object({
  workspaceId: uuidSchema,
  customerId:  uuidSchema,
  validUntil:  z.string().datetime({ offset: true }).optional(),
  notes:       z.string().max(2000).trim().optional(),
  boardId:     uuidSchema.optional(),
  groupId:     uuidSchema.optional(),
  itemId:      uuidSchema.optional(),
  lines:       z.array(estimateLineSchema).min(1, "At least one line item"),
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
  dueDate:     z.string().datetime({ offset: true }).optional(),
  notes:       z.string().max(2000).trim().optional(),
  boardId:     uuidSchema.optional(),
  groupId:     uuidSchema.optional(),
  itemId:      uuidSchema.optional(),
  lines:       z.array(invoiceLineSchema).min(1, "At least one line item"),
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
  amount:          z.coerce.number().positive("Must be > 0"), // major units
  spentAt:         z.string().datetime({ offset: true }).optional(),
  description:     z.string().max(2000).trim().optional(),
  receiptFilePath: z.string().max(1000).optional(),
  boardId:         uuidSchema.optional(),
  groupId:         uuidSchema.optional(),
  itemId:          uuidSchema.optional(),
});

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
