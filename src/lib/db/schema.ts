import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  pgEnum,
  boolean,
  primaryKey,
  unique,
  integer,
  jsonb,
  real,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ── Enums ──────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "user",
  // Shop-floor identity: clocks in via badge + PIN, no web login (Plan D.3)
  "worker",
]);

// Scope-ladder level used by the configurable linking engine (Plan B.4.1)
export const linkLevelEnum = pgEnum("link_level", [
  "none",
  "workspace",
  "board",
  "group",
  "item",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "inactive",
  "pending",
]);

// ── Users ──────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  password: text("password"), // null for magic-link-only users
  image: text("image"),
  role: userRoleEnum("role").default("user").notNull(),
  status: userStatusEnum("status").default("pending").notNull(),
  // Link to employee record (set when user is connected to an employee).
  // `AnyPgColumn` annotation breaks the users↔employees circular type cycle.
  employeeId: uuid("employee_id").references((): AnyPgColumn => employees.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Accounts (OAuth / NextAuth) ────────────────────────────────────
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 })
      .$type<AdapterAccountType>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (account) => [
    primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  ]
);

// ── Sessions ───────────────────────────────────────────────────────
export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 })
    .notNull()
    .primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// ── Verification Tokens (magic links & email verification) ─────────
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [
    primaryKey({ columns: [vt.identifier, vt.token] }),
  ]
);

// ── Invitation Tokens ──────────────────────────────────────────────
export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  role: userRoleEnum("role").default("user").notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  invitedBy: uuid("invited_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accepted: boolean("accepted").default(false).notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// PROJECT MANAGEMENT (Monday.com-style)
// ════════════════════════════════════════════════════════════════════

// ── Column Type Enum ───────────────────────────────────────────────
export const columnTypeEnum = pgEnum("column_type", [
  "text",
  "number",
  "status",
  "date",
  "person",
  "dropdown",
  "checkbox",
  "link",
  "priority",
  "rating",
  "formula",
]);

// ── Workspaces ─────────────────────────────────────────────────────
export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3b82f6").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // ── Business-ops money settings (Plan §2.3) ──────────────────────
  // ISO-4217 currency code; all monetary columns store integer minor units
  // (see lib/money.ts). fiscalYearStart is 1–12 (month the FY begins).
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  fiscalYearStart: integer("fiscal_year_start").default(1).notNull(),
  // ── Localization profile (BRD 00 §12) ────────────────────────────
  // ISO 3166-1 alpha-2 country drives the tax regime, party tax-ID label,
  // statutory document set, and formatting via the country pack
  // (src/lib/localization.ts). locale = BCP-47 (e.g. en-US).
  country: varchar("country", { length: 2 }).default("US").notNull(),
  locale: varchar("locale", { length: 10 }).default("en-US").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("UTC").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Workspace Members ──────────────────────────────────────────────
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).default("member").notNull(), // owner | admin | member
    // Sub-app access permissions
    canAccessBoards: boolean("can_access_boards").default(true).notNull(),
    canAccessInspections: boolean("can_access_inspections").default(false).notNull(),
    canAccessDocSign: boolean("can_access_doc_sign").default(false).notNull(),
    canAccessTimeClock: boolean("can_access_time_clock").default(false).notNull(),
    // ── Business-ops module access (Plan §1.3 / §2.5) ────────────────
    canAccessVendors: boolean("can_access_vendors").default(false).notNull(),
    canAccessPurchasing: boolean("can_access_purchasing").default(false).notNull(),
    canAccessInventory: boolean("can_access_inventory").default(false).notNull(),
    canAccessInvoicing: boolean("can_access_invoicing").default(false).notNull(),
    canAccessExpenses: boolean("can_access_expenses").default(false).notNull(),
    canAccessHR: boolean("can_access_hr").default(false).notNull(),
    canAccessTraining: boolean("can_access_training").default(false).notNull(),
    joinedAt: timestamp("joined_at", { mode: "date" }).defaultNow().notNull(),
  },
  (wm) => [primaryKey({ columns: [wm.workspaceId, wm.userId] })]
);

// ── Workspace Labels (custom naming per workspace) ─────────────────
// Admins can rename "Board", "Project", "Task" labels workspace-wide
export const workspaceLabels = pgTable("workspace_labels", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" })
    .unique(),
  // PM Board labels
  boardLabel: varchar("board_label", { length: 100 }).default("Board").notNull(),
  groupLabel: varchar("group_label", { length: 100 }).default("Group").notNull(),
  itemLabel: varchar("item_label", { length: 100 }).default("Item").notNull(),
  // Employee module labels (shared across Inspections, Time Clock, DocSign)
  projectLabel: varchar("project_label", { length: 100 }).default("Project").notNull(),
  taskLabel: varchar("task_label", { length: 100 }).default("Task").notNull(),
  workshopLabel: varchar("workshop_label", { length: 100 }).default("Workshop").notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Boards ─────────────────────────────────────────────────────────
export const boards = pgTable("boards", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).default("#3b82f6").notNull(),
  position: real("position").default(0).notNull(),
  // public | private | invite_only
  visibility: varchar("visibility", { length: 20 }).default("private").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Groups (sections inside a board) ───────────────────────────────
export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 7 }).default("#3b82f6").notNull(),
  position: real("position").default(0).notNull(),
  collapsed: boolean("collapsed").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Columns (custom field definitions per board) ───────────────────
export const columns = pgTable("columns", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: columnTypeEnum("type").notNull(),
  position: real("position").default(0).notNull(),
  width: integer("width").default(150).notNull(),
  // Config for dropdowns, statuses, etc: { labels: [{id, text, color}], ... }
  config: jsonb("config").default("{}").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Items (rows) ───────────────────────────────────────────────────
export const items = pgTable("items", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  groupId: uuid("group_id")
    .notNull()
    .references(() => groups.id, { onDelete: "cascade" }),
  // Denormalized tenant id (Plan D.4.3) — lets cross-module/tenant queries
  // filter without a board join. Backfilled from boards.workspaceId.
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 500 }).notNull(),
  position: real("position").default(0).notNull(),
  // First-class scheduling fields for the task (powers Gantt/Calendar durations).
  startDate: timestamp("start_date", { mode: "date" }),
  endDate: timestamp("end_date", { mode: "date" }),
  // Soft-archive (Plan D.6) — replaces the "[Archived] " name-prefix hack.
  archivedAt: timestamp("archived_at", { mode: "date" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Cell Values (the actual data at item × column intersection) ────
export const cellValues = pgTable(
  "cell_values",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    columnId: uuid("column_id")
      .notNull()
      .references(() => columns.id, { onDelete: "cascade" }),
    textValue: text("text_value"),
    numberValue: real("number_value"),
    booleanValue: boolean("boolean_value"),
    dateValue: timestamp("date_value", { mode: "date" }),
    jsonValue: jsonb("json_value"), // for complex values (person[], dropdown, etc.)
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (cv) => [primaryKey({ columns: [cv.itemId, cv.columnId] })]
);

// ── Activity Log ───────────────────────────────────────────────────
export const activityLog = pgTable("activity_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 50 }).notNull(), // created, updated, deleted, moved, etc.
  details: jsonb("details").default("{}").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// INSPECTIONS MODULE
// ════════════════════════════════════════════════════════════════════

export const inspectionTemplates = pgTable("inspection_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  isPublished: boolean("is_published").default(false).notNull(),
  scoringEnabled: boolean("scoring_enabled").default(true).notNull(),
  // Link template to a specific board — items on that board are the "jobs/projects"
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  // NCR template support
  isNcr: boolean("is_ncr").default(false).notNull(),
  ncrDocNumberFormat: varchar("ncr_doc_number_format", { length: 100 }), // e.g. "NCR-{SEQ}"
  // PDF template for export
  pdfTemplateId: uuid("pdf_template_id"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const templateSections = pgTable("template_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => inspectionTemplates.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  position: real("position").default(0).notNull(),
  // Page grouping — sections with same pageNumber render on the same page/screen
  pageNumber: integer("page_number").default(1).notNull(),
  // Repeatable sections (e.g. multiple NCR entries within one report)
  isRepeatable: boolean("is_repeatable").default(false).notNull(),
  maxRepetitions: integer("max_repetitions"), // null = unlimited
  // Per-section sign-off requirements
  requiresSignoff: boolean("requires_signoff").default(false).notNull(),
  // Roles required to sign off, in order: e.g. ["operator", "qc_technician"]
  signoffRoles: jsonb("signoff_roles"),
});

export const templateQuestions = pgTable("template_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => templateSections.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  // yes_no_na | text | number | checkbox | date | photo | dropdown | multiple_choice | rating | signature
  // New: long_text | multiple_selection | table | document_number | site_name | asset_name | company_name
  type: varchar("type", { length: 50 }).notNull(),
  required: boolean("required").default(false).notNull(),
  scoring: boolean("scoring").default(true).notNull(),
  weight: real("weight").default(1).notNull(),
  // [{id, text, score?, flagged?}] for dropdown/mc/multiple_selection
  // For table type: { columns: [{id, name, type}], defaultRows: number }
  options: jsonb("options").default("[]").notNull(),
  position: real("position").default(0).notNull(),
  // Conditional logic rules: [{ condition: { questionId, operator, value }, action: { type, config } }]
  conditionalRules: jsonb("conditional_rules"),
  // Template-level flag rules: { values: string[], autoFlag: true }
  flagRules: jsonb("flag_rules"),
  // Link this question's answer to another question in the same template
  linkedQuestionId: uuid("linked_question_id"),
  // Rich instructions (text, image, video) for the inspector
  instructions: jsonb("instructions"),
});

export const inspections = pgTable("inspections", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => inspectionTemplates.id, { onDelete: "restrict" }),
  // Full snapshot of template at time of inspection so edits don't affect reports
  templateSnapshot: jsonb("template_snapshot").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  site: varchar("site", { length: 255 }),
  // Workspace scope (optional — links inspection to a workspace for filtering)
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  // ── Resolved scope ladder (Plan B.4 / D.5b) ──────────────────────
  // The "primary placement" of this inspection on the work hierarchy.
  // workspaceId above is the tenant; these drill deeper. The deepest
  // non-null column equals linkLevel. Powers the 360° item view + roll-ups.
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  linkLevel: linkLevelEnum("link_level").default("none").notNull(),
  // Stored report artifact (generated PDF) surfaced in the item Documents tab.
  reportFilePath: text("report_file_path"),
  conductedBy: uuid("conducted_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // in_progress | pending_review | completed | remediated
  status: varchar("status", { length: 20 }).default("in_progress").notNull(),
  // NCR lifecycle (Plan E.2 Compliance Loop): null | raised | dispositioned | closed
  ncrStatus: varchar("ncr_status", { length: 20 }),
  score: real("score"), // 0–100
  // NCR number (per-item auto-inc): e.g. "NCR-001"
  ncrNumber: varchar("ncr_number", { length: 50 }),
  startedAt: timestamp("started_at", { mode: "date" }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const inspectionResponses = pgTable("inspection_responses", {
  id: uuid("id").defaultRandom().primaryKey(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id, { onDelete: "cascade" }),
  questionId: uuid("question_id").notNull(), // not a FK – snapshot covers it
  sectionId: uuid("section_id").notNull(),
  // For repeatable sections: 0 = original, 1+ = repeated instances
  repeatIndex: integer("repeat_index").default(0).notNull(),
  value: jsonb("value"), // flexible: string | number | boolean | {url,name} | etc.
  flagged: boolean("flagged").default(false).notNull(),
  note: text("note"),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const inspectionActions = pgTable("inspection_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id, { onDelete: "cascade" }),
  questionId: uuid("question_id"),
  title: text("title").notNull(),
  priority: varchar("priority", { length: 20 }).default("medium").notNull(), // low | medium | high | critical
  status: varchar("status", { length: 20 }).default("open").notNull(), // open | in_progress | resolved
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date", { mode: "date" }),
  // ── Quality Loop (Plan D.4.1 / E.2 Workflow 1) ───────────────────
  // A corrective action IS a task. These let it spawn / sync with a board item.
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }), // target board for auto-creation
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),    // the board task it spawned
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Inspection Signatures (immutable, Employee ID-authenticated) ────
export const inspectionSignatures = pgTable("inspection_signatures", {
  id: uuid("id").defaultRandom().primaryKey(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id").notNull(),
  questionId: uuid("question_id"),
  // The employee who signed (validated via Employee ID at signature time)
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "restrict" }),
  // Snapshot fields — immutable record of who signed
  signatureData: text("signature_data").notNull(), // base64 PNG from SignaturePad
  employeeName: varchar("employee_name", { length: 255 }).notNull(),
  employeeBadgeId: varchar("employee_badge_id", { length: 50 }).notNull(),
  role: varchar("role", { length: 50 }).notNull(), // operator | qc_technician | team_lead | manager
  signedAt: timestamp("signed_at", { mode: "date" }).defaultNow().notNull(),
  // Void support (only managers can void)
  isVoided: boolean("is_voided").default(false).notNull(),
  voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "set null" }),
  voidedAt: timestamp("voided_at", { mode: "date" }),
  voidReason: text("void_reason"),
});

// ── Inspection Audit Log ───────────────────────────────────────────
export const inspectionAuditLog = pgTable("inspection_audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  inspectionId: uuid("inspection_id")
    .notNull()
    .references(() => inspections.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  // created | viewed | response_updated | signature_added | signature_voided | submitted | status_changed | exported
  action: varchar("action", { length: 50 }).notNull(),
  details: jsonb("details").default("{}").notNull(),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── NCR Sequences (per board item auto-increment) ──────────────────
export const ncrSequences = pgTable("ncr_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" })
    .unique(),
  lastNumber: integer("last_number").default(0).notNull(),
});

// ── SOPs (Standard Operating Procedures) ───────────────────────────
export const sops = pgTable("sops", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: text("file_path").notNull(),
  category: varchar("category", { length: 100 }),
  description: text("description"),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Template ↔ SOP Links ──────────────────────────────────────────
export const templateSopLinks = pgTable("template_sop_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id")
    .notNull()
    .references(() => inspectionTemplates.id, { onDelete: "cascade" }),
  sectionId: uuid("section_id"), // null = linked at template level
  questionId: uuid("question_id"), // null = linked at section level
  sopId: uuid("sop_id")
    .notNull()
    .references(() => sops.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── PDF Templates (reusable export layouts) ───────────────────────
export const pdfTemplates = pgTable("pdf_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false).notNull(),
  // Full layout configuration stored as JSON
  config: jsonb("config").default("{}").notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// EMPLOYEE MANAGEMENT MODULE
// ════════════════════════════════════════════════════════════════════

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "inactive",
  "on_leave",
]);

// Master employee records
export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  // ── Identity unification (Plan D.3) ──────────────────────────────
  // One human = one users row; employees is a 1:1 profile extension.
  // Interim approach: enforce the FK, keep users canonical for reporting.
  // `AnyPgColumn` annotation breaks the users↔employees circular type cycle
  // (users.employeeId references employees, employees.userId references users).
  userId: uuid("user_id")
    .references((): AnyPgColumn => users.id, { onDelete: "cascade" })
    .unique(),
  // Tenant boundary (Plan D.2.1) — was entirely absent on this module.
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  employeeId: varchar("employee_id", { length: 50 }).notNull().unique(), // Badge / HR code
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  department: varchar("department", { length: 100 }),
  designation: varchar("designation", { length: 100 }),
  joiningDate: timestamp("joining_date", { mode: "date" }),
  // ── Manager hierarchy (Plan §2.4 / §8) — drives default approval routing ──
  // Self-FK; `AnyPgColumn` annotation breaks the self-referential type cycle.
  managerEmployeeId: uuid("manager_employee_id").references((): AnyPgColumn => employees.id, { onDelete: "set null" }),
  // ── HR fields (Plan §8) — `department` varchar kept for back-compat ──
  departmentId: uuid("department_id").references((): AnyPgColumn => departments.id, { onDelete: "set null" }),
  employmentType: varchar("employment_type", { length: 40 }), // full_time | part_time | contract | intern
  dateOfBirth: timestamp("date_of_birth", { mode: "date" }),
  avatarUrl: text("avatar_url"),
  // Hashed PIN for shared-device signature authentication (future use)
  pin: varchar("pin", { length: 255 }),
  status: employeeStatusEnum("status").default("active").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// Physical work areas / workshops / stations
export const workshops = pgTable("workshops", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Tenant boundary (Plan D.2.1)
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Projects for employee time-tracking (separate from PM boards)
export const empProjects = pgTable("emp_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Tenant boundary (Plan D.2.1)
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  workshopId: uuid("workshop_id").references(() => workshops.id, {
    onDelete: "set null",
  }),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active | completed | on_hold
  startDate: timestamp("start_date", { mode: "date" }),
  endDate: timestamp("end_date", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// Tasks within projects
export const empTasks = pgTable("emp_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .notNull()
    .references(() => empProjects.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  estimatedMinutes: integer("estimated_minutes"),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active | completed | on_hold
  position: real("position").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Document Signing ───────────────────────────────────────────────

export const signDocumentStatusEnum = pgEnum("sign_document_status", [
  "draft",
  "pending",
  "completed",
  "voided",
  "declined",
]);

export const signRecipientStatusEnum = pgEnum("sign_recipient_status", [
  "pending",
  "viewed",
  "signed",
  "declined",
]);

export const signFieldTypeEnum = pgEnum("sign_field_type", [
  "signature",
  "initials",
  "date",
  "text",
  "checkbox",
]);

export const signDocuments = pgTable("sign_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  fileName: varchar("file_name", { length: 255 }).notNull(),
  filePath: text("file_path").notNull(),
  message: text("message"),
  status: signDocumentStatusEnum("status").default("draft").notNull(),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  // Workspace scope (optional — links document to a workspace for access control)
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),
  // ── Resolved scope ladder (Plan B.4 / D.5b) — link a doc to a task/inspection ──
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  linkLevel: linkLevelEnum("link_level").default("none").notNull(),
  dueDate: timestamp("due_date", { mode: "date" }),
  pageCount: integer("page_count").default(1).notNull(),
  completedAt: timestamp("completed_at", { mode: "date" }),
  completedFilePath: text("completed_file_path"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const signRecipients = pgTable("sign_recipients", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => signDocuments.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  role: varchar("role", { length: 20 }).default("signer").notNull(),
  order: integer("order").default(1).notNull(),
  status: signRecipientStatusEnum("status").default("pending").notNull(),
  token: uuid("token").defaultRandom().notNull().unique(),
  color: varchar("color", { length: 20 }).default("#3B82F6").notNull(),
  signedAt: timestamp("signed_at", { mode: "date" }),
  declineReason: text("decline_reason"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const signFields = pgTable("sign_fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => signDocuments.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").references(() => signRecipients.id, {
    onDelete: "cascade",
  }),
  type: signFieldTypeEnum("type").notNull(),
  page: integer("page").notNull(), // 1-based page number
  x: real("x").notNull(), // % of page width (0-100)
  y: real("y").notNull(), // % of page height (0-100)
  width: real("width").notNull(), // % of page width
  height: real("height").notNull(), // % of page height
  required: boolean("required").default(true).notNull(),
  label: varchar("label", { length: 100 }),
  value: text("value"), // filled value after signing
  completedAt: timestamp("completed_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const signEvents = pgTable("sign_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id")
    .notNull()
    .references(() => signDocuments.id, { onDelete: "cascade" }),
  recipientId: uuid("recipient_id").references(() => signRecipients.id, {
    onDelete: "set null",
  }),
  eventType: varchar("event_type", { length: 50 }).notNull(),
  description: text("description"),
  ipAddress: varchar("ip_address", { length: 50 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Time-clock check-in / check-out records
export const timeLogs = pgTable("time_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  // Tenant boundary (Plan D.2.1)
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  // Labor structure (workshop → project → task), selectable in parallel (Plan B.4.3)
  workshopId: uuid("workshop_id").references(() => workshops.id, {
    onDelete: "set null",
  }),
  projectId: uuid("project_id").references(() => empProjects.id, {
    onDelete: "set null",
  }),
  taskId: uuid("task_id").references(() => empTasks.id, {
    onDelete: "set null",
  }),
  // ── Resolved scope ladder (Plan B.4 / D.5b) — labor rolls up to work ──
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  linkLevel: linkLevelEnum("link_level").default("none").notNull(),
  checkInAt: timestamp("check_in_at", { mode: "date" }).notNull(),
  checkInPhoto: text("check_in_photo"),
  checkOutAt: timestamp("check_out_at", { mode: "date" }),
  checkOutPhoto: text("check_out_photo"),
  durationMinutes: integer("duration_minutes"), // set on checkout
  notes: text("notes"),
  status: varchar("status", { length: 20 }).default("active").notNull(), // active | completed
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// INTERCONNECTION TABLES
// ════════════════════════════════════════════════════════════════════

// ── Board Column Permissions ───────────────────────────────────────
// Per-user, per-column (or per-board when columnId is null = board-level) ACL
export const boardColumnPermissions = pgTable(
  "board_column_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    // null means permission applies to all columns on this board for this user
    columnId: uuid("column_id").references(() => columns.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canView: boolean("can_view").default(true).notNull(),
    canEdit: boolean("can_edit").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  }
);

// ── Board Row (Item) Permissions ───────────────────────────────────
// Per-user, per-item (row) access control
export const boardItemPermissions = pgTable(
  "board_item_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    canView: boolean("can_view").default(true).notNull(),
    canEdit: boolean("can_edit").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  }
);

// ── Status Change Notification Rules ──────────────────────────────
// When a status/dropdown column on a board changes to a specific value,
// send email notifications to the configured users.
export const statusNotifications = pgTable("status_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  columnId: uuid("column_id")
    .notNull()
    .references(() => columns.id, { onDelete: "cascade" }),
  // The status value that triggers the notification (e.g. "Done", "Blocked")
  triggerValue: varchar("trigger_value", { length: 255 }).notNull(),
  // JSON array of user IDs to notify: string[]
  notifyUserIds: jsonb("notify_user_ids").default("[]").notNull(),
  emailSubject: varchar("email_subject", { length: 255 }),
  // Optional custom body template; use {{item}}, {{board}}, {{status}} tokens
  emailBody: text("email_body"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Inspection ↔ Board Item Links ─────────────────────────────────
// Completed inspections can be linked to board items (tasks/cards).
// When an inspection is completed, it surfaces in the board card detail panel.
export const inspectionItemLinks = pgTable(
  "inspection_item_links",
  {
    inspectionId: uuid("inspection_id")
      .notNull()
      .references(() => inspections.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at", { mode: "date" }).defaultNow().notNull(),
    linkedBy: uuid("linked_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [primaryKey({ columns: [t.inspectionId, t.itemId] })]
);

// ── Time Log ↔ Board Item Links ────────────────────────────────────
// Employee clock-in/out records can be associated with board items.
// Time spent surfaces in the board card detail panel.
export const timeLogItemLinks = pgTable(
  "time_log_item_links",
  {
    timeLogId: uuid("time_log_id")
      .notNull()
      .references(() => timeLogs.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.timeLogId, t.itemId] })]
);

// ════════════════════════════════════════════════════════════════════
// COMMENTS & COLLABORATION
// ════════════════════════════════════════════════════════════════════

export const comments = pgTable("comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  itemId: uuid("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  // Parsed @mention user IDs: string[]
  mentionedUserIds: jsonb("mentioned_user_ids").default("[]").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// IN-APP NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // comment_mention | automation_triggered | item_assigned | status_changed | form_submitted
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  // Optional context links
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "cascade" }),
  // Extra payload (e.g. comment ID, automation ID)
  meta: jsonb("meta").default("{}").notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// AUTOMATION ENGINE
// ════════════════════════════════════════════════════════════════════

// Trigger types: column_changed | item_created | date_reached | form_submitted
// Action types: notify_user | send_email | move_to_group | change_field | set_date | archive_item
export const automations = pgTable("automations", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  triggerType: varchar("trigger_type", { length: 50 }).notNull(),
  // triggerConfig shape depends on triggerType:
  // column_changed: { columnId, fromValue?, toValue }
  // item_created: {}
  // date_reached: { columnId, offsetDays }  (0 = on due date, -1 = 1 day before, etc.)
  // form_submitted: { formId }
  triggerConfig: jsonb("trigger_config").default("{}").notNull(),
  actionType: varchar("action_type", { length: 50 }).notNull(),
  // actionConfig shape depends on actionType:
  // notify_user: { userIds: string[], message }
  // send_email: { to: string, subject, body }
  // move_to_group: { groupId }
  // change_field: { columnId, value }
  // set_date: { columnId, offsetDays }
  // archive_item: {}
  actionConfig: jsonb("action_config").default("{}").notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const automationLogs = pgTable("automation_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  automationId: uuid("automation_id")
    .notNull()
    .references(() => automations.id, { onDelete: "cascade" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  triggeredAt: timestamp("triggered_at", { mode: "date" }).defaultNow().notNull(),
  status: varchar("status", { length: 20 }).default("success").notNull(), // success | error
  details: jsonb("details").default("{}").notNull(),
});

// ════════════════════════════════════════════════════════════════════
// FORMS BUILDER
// ════════════════════════════════════════════════════════════════════

export const forms = pgTable("forms", {
  id: uuid("id").defaultRandom().primaryKey(),
  boardId: uuid("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // Public forms are accessible without login and produce board items on submit
  isPublic: boolean("is_public").default(true).notNull(),
  // Unique slug for public URL: /forms/[slug]
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  // Optional custom submit message
  submitMessage: text("submit_message").default("Thank you! Your response has been recorded."),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// Each field in the form maps to a board column
export const formFields = pgTable("form_fields", {
  id: uuid("id").defaultRandom().primaryKey(),
  formId: uuid("form_id")
    .notNull()
    .references(() => forms.id, { onDelete: "cascade" }),
  // Linked to a board column; null = the item "Name" field
  columnId: uuid("column_id").references(() => columns.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 255 }).notNull(),
  helpText: text("help_text"),
  isVisible: boolean("is_visible").default(true).notNull(),
  isRequired: boolean("is_required").default(false).notNull(),
  // URL query param name for pre-filling this field
  prefillParam: varchar("prefill_param", { length: 100 }),
  position: real("position").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// EVENT BACKBONE — transactional outbox (Plan C.3 / D.5)
// Producers write a domain row AND an outbox row in the SAME transaction.
// A worker/cron dispatches pending rows to consumers (automations,
// notifications, corrective-action creation, roll-ups). Guarantees no
// lost events and no dual-write inconsistency.
// ════════════════════════════════════════════════════════════════════

export const eventStatusEnum = pgEnum("event_status", [
  "pending",
  "processing",
  "done",
  "dead",
]);

export const eventOutbox = pgTable("event_outbox", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  // 'item.status_changed' | 'inspection.submitted' | 'inspection.flagged'
  // | 'ncr.raised' | 'form.submitted' | 'timelog.checked_in' | 'timelog.checked_out'
  // | 'signdoc.completed' | ...
  eventType: varchar("event_type", { length: 100 }).notNull(),
  aggregateType: varchar("aggregate_type", { length: 50 }), // 'item' | 'inspection' | ...
  aggregateId: uuid("aggregate_id"),
  payload: jsonb("payload").default("{}").notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  occurredAt: timestamp("occurred_at", { mode: "date" }).defaultNow().notNull(),
  processedAt: timestamp("processed_at", { mode: "date" }), // null = pending
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  status: eventStatusEnum("status").default("pending").notNull(),
});

// ════════════════════════════════════════════════════════════════════
// GENERIC ENTITY LINKS (Plan D.4.2)
// One table for the long tail of loose associations (sign-doc ↔ inspection,
// sign-doc ↔ item, inspection "remediates" item, …) so we don't spawn a new
// join table per pair. Strong, hot links keep their dedicated tables.
// ════════════════════════════════════════════════════════════════════

export const entityLinks = pgTable(
  "entity_links",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
    sourceType: varchar("source_type", { length: 40 }).notNull(), // 'inspection' | 'sign_document' | 'time_log' | 'item' | ...
    sourceId: uuid("source_id").notNull(),
    targetType: varchar("target_type", { length: 40 }).notNull(),
    targetId: uuid("target_id").notNull(),
    relation: varchar("relation", { length: 40 }).notNull(), // 'evidence_for' | 'remediates' | 'belongs_to' | ...
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [
    // Surrogate `id` is the PK; this composite is a uniqueness guard (Plan D.4.2).
    unique("entity_links_uq").on(
      t.sourceType,
      t.sourceId,
      t.targetType,
      t.targetId,
      t.relation
    ),
  ]
);

// ════════════════════════════════════════════════════════════════════
// CONFIGURABLE LINKING & SCOPE GOVERNANCE (Plan B.4 / D.5b)
// Admin rules, per workspace × module, for the scope ladder. The shared
// linker component + server enforcement both read this.
// ════════════════════════════════════════════════════════════════════

export const linkModeEnum = pgEnum("link_mode", ["disabled", "optional", "required"]);

export const linkPolicies = pgTable(
  "link_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    module: varchar("module", { length: 30 }).notNull(), // 'inspection' | 'time_clock' | 'sign' | 'form'
    mode: linkModeEnum("mode").default("optional").notNull(),
    allowGeneral: boolean("allow_general").default(true).notNull(), // may link to nothing?
    minLevel: linkLevelEnum("min_level").default("none").notNull(),
    maxLevel: linkLevelEnum("max_level").default("item").notNull(),
    // Per-rung selection rules (dial #3), e.g.:
    // [{ "level":"board","selection":"free" },
    //  { "level":"group","selection":"predefined","options":["grp_a"] },
    //  { "level":"item","selection":"free" }]
    rungRules: jsonb("rung_rules").default("[]").notNull(),
    defaultTarget: jsonb("default_target"), // pre-selected / locked value
    isActive: boolean("is_active").default(true).notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  // Surrogate `id` is the PK; one policy per workspace × module (Plan D.5b).
  (t) => [unique("link_policies_ws_module_uq").on(t.workspaceId, t.module)]
);

// ════════════════════════════════════════════════════════════════════
// ACTIVITY FEED — unified read model / timeline backbone (Plan B.5.4)
// One denormalized row per meaningful action, carrying full ancestry, so
// the task timeline, board feed and workspace feed are each ONE indexed
// read. Populated by the event dispatcher (eventually consistent).
// ════════════════════════════════════════════════════════════════════

export const activityFeed = pgTable("activity_feed", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  refType: varchar("ref_type", { length: 30 }).notNull(), // 'time_log' | 'inspection' | 'sign_document' | 'comment' | 'item'
  refId: uuid("ref_id"),
  action: varchar("action", { length: 50 }).notNull(), // 'clocked_in' | 'inspection_submitted' | 'document_signed' | ...
  summary: text("summary"), // human-readable timeline line
  occurredAt: timestamp("occurred_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// NOTIFICATION PREFERENCES (Plan D.5.2)
// Per-user fan-out choice (in-app / email / none) per event type. The
// unified Notifications consumer respects these.
// ════════════════════════════════════════════════════════════════════

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: varchar("event_type", { length: 100 }).notNull(), // '*' = default for all
    inApp: boolean("in_app").default(true).notNull(),
    email: boolean("email").default(true).notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.eventType] })]
);

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS PLATFORM — Phase 1: Shared Primitives (Plan §2)
// Additive foundation every new module depends on: parties (vendors /
// customers), document numbering, money/tax config, and one generic
// approval engine. Each carries `workspaceId` (the tenant boundary) and
// plugs into the existing event outbox + activity_feed + entity_links.
// ════════════════════════════════════════════════════════════════════

// ── Parties: shared status ─────────────────────────────────────────
export const partyStatusEnum = pgEnum("party_status", ["active", "inactive"]);

// ── Vendors / Suppliers (Plan §2.1 / §3) ───────────────────────────
export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  // Short workspace-unique code (e.g. "ACME"); used on POs/bills.
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  taxId: varchar("tax_id", { length: 100 }),
  // Free-form address block (line1, line2, city, state, postalCode, country).
  address: jsonb("address").default("{}").notNull(),
  // Net payment terms in days (e.g. 30 = Net-30). Used for bill due dates.
  paymentTermsDays: integer("payment_terms_days").default(30).notNull(),
  // Internal owner of the relationship.
  accountManagerEmployeeId: uuid("account_manager_employee_id").references(() => employees.id, { onDelete: "set null" }),
  notes: text("notes"),
  status: partyStatusEnum("status").default("active").notNull(),
  // Vendor full BRD: onboarding approval state + preferred flag + auto-hold.
  approvalState: varchar("approval_state", { length: 20 }).default("approved").notNull(),
  isPreferred: boolean("is_preferred").default(false).notNull(),
  onHold: boolean("on_hold").default(false).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("vendors_ws_code_uq").on(t.workspaceId, t.code)]);

// ── Vendor contacts (optional multi-contact, Plan §3) ──────────────
export const vendorContacts = pgTable("vendor_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  title: varchar("title", { length: 100 }),
  isPrimary: boolean("is_primary").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// VENDOR — full BRD: structured addresses, compliance documents (+expiry),
// bank accounts, performance scorecards, and a vendor item catalog.
// ════════════════════════════════════════════════════════════════════

export const vendorAddressKindEnum = pgEnum("vendor_address_kind", ["billing", "shipping", "remit"]);
export const vendorDocStatusEnum = pgEnum("vendor_doc_status", ["valid", "expiring", "expired"]);

export const vendorAddresses = pgTable("vendor_addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  kind: vendorAddressKindEnum("kind").default("billing").notNull(),
  line1: varchar("line1", { length: 255 }),
  line2: varchar("line2", { length: 255 }),
  city: varchar("city", { length: 120 }),
  state: varchar("state", { length: 120 }),
  country: varchar("country", { length: 2 }),
  postalCode: varchar("postal_code", { length: 20 }),
});

export const vendorDocuments = pgTable("vendor_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  docType: varchar("doc_type", { length: 120 }).notNull(),
  number: varchar("number", { length: 120 }),
  issuedDate: timestamp("issued_date", { mode: "date" }),
  expiryDate: timestamp("expiry_date", { mode: "date" }),
  fileUrl: text("file_url"),
  isMandatory: boolean("is_mandatory").default(false).notNull(),
  status: vendorDocStatusEnum("status").default("valid").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const vendorBankAccounts = pgTable("vendor_bank_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  accountName: varchar("account_name", { length: 255 }),
  accountNumber: varchar("account_number", { length: 60 }),
  bankName: varchar("bank_name", { length: 255 }),
  branch: varchar("branch", { length: 255 }),
  routing: varchar("routing", { length: 60 }), // IFSC / SWIFT / ABA
  isVerified: boolean("is_verified").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Periodic performance scorecard (on-time %, quality reject %, price variance %).
export const vendorPerformance = pgTable("vendor_performance", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  periodStart: timestamp("period_start", { mode: "date" }),
  periodEnd: timestamp("period_end", { mode: "date" }),
  onTimePct: real("on_time_pct").default(0).notNull(),
  qualityRejectPct: real("quality_reject_pct").default(0).notNull(),
  priceVariancePct: real("price_variance_pct").default(0).notNull(),
  rating: real("rating").default(0).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Vendor item catalog — what a vendor supplies, their SKU, price, lead time.
export const vendorItems = pgTable("vendor_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id").notNull().references(() => vendors.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  vendorSku: varchar("vendor_sku", { length: 120 }),
  description: varchar("description", { length: 255 }),
  unitPriceMinor: integer("unit_price_minor").default(0).notNull(),
  leadTimeDays: integer("lead_time_days").default(0).notNull(),
  isApproved: boolean("is_approved").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Customers / Bill-to parties (Plan §2.1 / §6) ───────────────────
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 50 }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  taxId: varchar("tax_id", { length: 100 }),
  billingAddress: jsonb("billing_address").default("{}").notNull(),
  shippingAddress: jsonb("shipping_address").default("{}").notNull(),
  paymentTermsDays: integer("payment_terms_days").default(30).notNull(),
  // Sales full BRD: credit limit (minor units; 0 = no limit) + price list.
  creditLimitMinor: integer("credit_limit_minor").default(0).notNull(),
  priceListId: uuid("price_list_id").references((): AnyPgColumn => priceLists.id, { onDelete: "set null" }),
  accountManagerEmployeeId: uuid("account_manager_employee_id").references(() => employees.id, { onDelete: "set null" }),
  // Optional link to the project board this customer's work lives on.
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  notes: text("notes"),
  status: partyStatusEnum("status").default("active").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("customers_ws_code_uq").on(t.workspaceId, t.code)]);

// ── Document numbering (Plan §2.2) ─────────────────────────────────
// Generalizes ncrSequences into one table keyed by (workspace, docType,
// scopeId?). `nextDocNumber(tx, …)` atomically bumps lastNumber inside the
// producing transaction. format tokens: {YYYY} {YY} {MM} {SEQ} {PREFIX}.
export const documentSequences = pgTable("document_sequences", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  // 'invoice' | 'purchase_order' | 'expense' | 'estimate' | 'sales_order' | 'goods_receipt'
  docType: varchar("doc_type", { length: 40 }).notNull(),
  // Optional sub-scope (e.g. per-board sequences); empty string = workspace-wide.
  scopeId: varchar("scope_id", { length: 64 }).default("").notNull(),
  prefix: varchar("prefix", { length: 20 }).default("").notNull(),
  // e.g. "INV-{YYYY}-{SEQ}" ; {SEQ} is zero-padded to `padding` width.
  format: varchar("format", { length: 100 }).default("{PREFIX}{SEQ}").notNull(),
  padding: integer("padding").default(4).notNull(),
  lastNumber: integer("last_number").default(0).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("doc_sequences_uq").on(t.workspaceId, t.docType, t.scopeId)]);

// ── Tax rates (Plan §2.3) ──────────────────────────────────────────
// Referenced by invoice / PO / expense line items. rateBasisPoints stores
// the percentage in basis points (e.g. 7.5% = 750) to avoid float drift.
export const taxRates = pgTable("tax_rates", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  rateBasisPoints: integer("rate_basis_points").default(0).notNull(),
  // 'sales' | 'purchase' | 'both'
  type: varchar("type", { length: 20 }).default("both").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Generic approval engine (Plan §2.4) ────────────────────────────
// One polymorphic engine for leave / PO / expense / invoice-send sign-off.
// A request emits approval.* events, fans out notifications to the current
// approver, writes activity_feed, and can spawn a board task. No per-module
// approval forks (Plan §13 "approval consistency").
export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
]);

export const approvalDecisionEnum = pgEnum("approval_decision", [
  "pending",
  "approved",
  "rejected",
  "skipped",
]);

export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  // 'leave_request' | 'purchase_order' | 'expense' | 'invoice'
  subjectType: varchar("subject_type", { length: 40 }).notNull(),
  subjectId: uuid("subject_id").notNull(),
  status: approvalStatusEnum("status").default("pending").notNull(),
  requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
  // 1-based index of the step currently awaiting a decision.
  currentStep: integer("current_step").default(1).notNull(),
  policyId: uuid("policy_id"),
  // Optional scope ladder so approvals surface in the 360° item view.
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at", { mode: "date" }),
}, (t) => [unique("approval_subject_uq").on(t.subjectType, t.subjectId)]);

export const approvalSteps = pgTable("approval_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  requestId: uuid("request_id")
    .notNull()
    .references(() => approvalRequests.id, { onDelete: "cascade" }),
  stepNumber: integer("step_number").notNull(), // 1-based, ordered
  // The approver: an employee, or a role fallback when employeeId is null.
  approverEmployeeId: uuid("approver_employee_id").references(() => employees.id, { onDelete: "set null" }),
  approverRole: varchar("approver_role", { length: 30 }), // 'manager' | 'admin' | 'finance' | ...
  decision: approvalDecisionEnum("decision").default("pending").notNull(),
  decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { mode: "date" }),
  comment: text("comment"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ── Approval policies (optional, admin) — step template per subject ─
export const approvalPolicies = pgTable("approval_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  subjectType: varchar("subject_type", { length: 40 }).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  // Ordered step template, e.g.
  // [{ "approverRole":"manager" },
  //  { "approverRole":"finance", "minAmountMinor": 100000 }]
  steps: jsonb("steps").default("[]").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("approval_policies_uq").on(t.workspaceId, t.subjectType)]);

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 2: Purchasing & Purchase Orders (Plan §5)
// PO → approval engine → vendor → goods receipt. Receipt records quantities
// now; the inventory stock-ledger consumer (Phase 3) reacts to po.received.
// All money in integer minor units (lib/money.ts). productId columns are
// nullable and FK-less until the `products` table lands in Phase 3.
// ════════════════════════════════════════════════════════════════════

export const purchaseOrderStatusEnum = pgEnum("purchase_order_status", [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "partially_received",
  "received",
  "closed",
  "cancelled",
]);

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id, { onDelete: "restrict" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  status: purchaseOrderStatusEnum("status").default("draft").notNull(),
  // Totals in minor units, recomputed from lines on every edit.
  subtotalMinor: integer("subtotal_minor").default(0).notNull(),
  taxMinor: integer("tax_minor").default(0).notNull(),
  totalMinor: integer("total_minor").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  expectedDate: timestamp("expected_date", { mode: "date" }),
  notes: text("notes"),
  // Purchasing full BRD: PO type (standard/blanket/contract), over-receipt
  // tolerance %, and 3-way match status.
  poType: varchar("po_type", { length: 20 }).default("standard").notNull(),
  overReceiptTolerancePct: real("over_receipt_tolerance_pct").default(0).notNull(),
  matchStatus: varchar("match_status", { length: 20 }).default("unmatched").notNull(),
  // ── Scope ladder (Plan B.4) — links the PO to a project board/item ──
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  linkLevel: linkLevelEnum("link_level").default("none").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("purchase_orders_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

export const poLineItems = pgTable("po_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  // FK to products (Phase 3); free-text description always set as a fallback.
  productId: uuid("product_id").references((): AnyPgColumn => products.id, { onDelete: "set null" }),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: real("quantity").default(1).notNull(),
  // Quantity received so far (driven by goods_receipt_lines).
  qtyReceived: real("qty_received").default(0).notNull(),
  unitCostMinor: integer("unit_cost_minor").default(0).notNull(),
  taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
  // Net (qty × unit cost) and tax, both in minor units.
  amountMinor: integer("amount_minor").default(0).notNull(),
  lineTaxMinor: integer("line_tax_minor").default(0).notNull(),
  position: real("position").default(0).notNull(),
});

export const goodsReceipts = pgTable("goods_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  purchaseOrderId: uuid("purchase_order_id")
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: "cascade" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  // Destination warehouse for the received goods (drives the stock receipt).
  warehouseId: uuid("warehouse_id").references((): AnyPgColumn => warehouses.id, { onDelete: "set null" }),
  receivedBy: uuid("received_by").references(() => users.id, { onDelete: "set null" }),
  receivedAt: timestamp("received_at", { mode: "date" }).defaultNow().notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const goodsReceiptLines = pgTable("goods_receipt_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  goodsReceiptId: uuid("goods_receipt_id")
    .notNull()
    .references(() => goodsReceipts.id, { onDelete: "cascade" }),
  poLineItemId: uuid("po_line_item_id")
    .notNull()
    .references(() => poLineItems.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references((): AnyPgColumn => products.id, { onDelete: "set null" }),
  quantity: real("quantity").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// PURCHASING — full BRD: requisitions, returns/debit notes, landed cost.
// ════════════════════════════════════════════════════════════════════

export const requisitionStatusEnum = pgEnum("requisition_status", ["draft", "submitted", "approved", "rejected", "converted"]);
export const purchaseReturnStatusEnum = pgEnum("purchase_return_status", ["draft", "posted", "cancelled"]);

export const purchaseRequisitions = pgTable("purchase_requisitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  status: requisitionStatusEnum("status").default("draft").notNull(),
  vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  neededBy: timestamp("needed_by", { mode: "date" }),
  notes: text("notes"),
  requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
  approverId: uuid("approver_id").references(() => users.id, { onDelete: "set null" }),
  convertedPoId: uuid("converted_po_id").references((): AnyPgColumn => purchaseOrders.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("requisitions_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

export const requisitionLines = pgTable("requisition_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  requisitionId: uuid("requisition_id").notNull().references(() => purchaseRequisitions.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: real("quantity").default(1).notNull(),
  estUnitCostMinor: integer("est_unit_cost_minor").default(0).notNull(),
  position: integer("position").default(0).notNull(),
});

// Allocated landed costs (freight, duty, …) added onto a PO's item cost.
export const poLandedCosts = pgTable("po_landed_costs", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
  costType: varchar("cost_type", { length: 40 }).default("freight").notNull(),
  amountMinor: integer("amount_minor").default(0).notNull(),
  note: varchar("note", { length: 255 }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Return-to-vendor / debit note — relieves stock when posted.
export const purchaseReturns = pgTable("purchase_returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  status: purchaseReturnStatusEnum("status").default("draft").notNull(),
  reason: varchar("reason", { length: 255 }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  postedAt: timestamp("posted_at", { mode: "date" }),
}, (t) => [unique("purchase_returns_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

export const purchaseReturnLines = pgTable("purchase_return_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  purchaseReturnId: uuid("purchase_return_id").notNull().references(() => purchaseReturns.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  description: varchar("description", { length: 500 }),
  quantity: real("quantity").default(1).notNull(),
  unitCostMinor: integer("unit_cost_minor").default(0).notNull(),
  position: integer("position").default(0).notNull(),
});

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 3: Inventory (Plan §4)
// Products + warehouses + an immutable stock-movement ledger. Stock is NEVER
// a bare counter: every change is a `stock_movements` row whose deltas roll
// into `stock_levels`. `available = onHand − committed` is derived. Reservation
// moves `committed` only; goods leave `onHand` exactly once, at shipment
// (Phase 5). Invoices never touch stock. (Plan §6.3 stock lifecycle.)
// ════════════════════════════════════════════════════════════════════

export const productTypeEnum = pgEnum("product_type", ["good", "service"]);

// Engineering lifecycle for a product (Product Management BRD).
export const productLifecycleEnum = pgEnum("product_lifecycle", [
  "draft",
  "active",
  "obsolete",
]);

// Inventory valuation method (full BRD): standard cost, weighted average, FIFO.
export const valuationMethodEnum = pgEnum("valuation_method", ["standard", "average", "fifo"]);

export const stockMovementTypeEnum = pgEnum("stock_movement_type", [
  "receipt",
  "reservation",
  "reservation_release",
  "shipment",
  "adjustment",
  "transfer",
]);

export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  sku: varchar("sku", { length: 80 }),
  name: varchar("name", { length: 255 }).notNull(),
  type: productTypeEnum("type").default("good").notNull(),
  // Free-text category / unit for now (normalized tables deferred — Plan §4).
  category: varchar("category", { length: 120 }),
  unit: varchar("unit", { length: 40 }).default("unit").notNull(),
  description: text("description"),
  costMinor: integer("cost_minor").default(0).notNull(),
  priceMinor: integer("price_minor").default(0).notNull(),
  // Reorder threshold; `stock.low` fires when available drops below it.
  reorderLevel: real("reorder_level").default(0).notNull(),
  // Services don't carry stock; the ledger/levels ignore non-tracked products.
  trackInventory: boolean("track_inventory").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // Inventory full-BRD attributes: barcode, lot/serial tracking, shelf life,
  // and per-product valuation method.
  barcode: varchar("barcode", { length: 120 }),
  tracksLots: boolean("tracks_lots").default(false).notNull(),
  tracksSerials: boolean("tracks_serials").default(false).notNull(),
  shelfLifeDays: integer("shelf_life_days").default(0).notNull(),
  valuationMethod: valuationMethodEnum("valuation_method").default("average").notNull(),
  // Engineering lifecycle (Product Management BRD): draft → active → obsolete.
  lifecycleStatus: productLifecycleEnum("lifecycle_status").default("active").notNull(),
  // Current released engineering revision label (e.g. "A"); null until released.
  currentRevision: varchar("current_revision", { length: 40 }),
  // Optional link to the project board this product belongs to.
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("products_ws_sku_uq").on(t.workspaceId, t.sku)]);

export const warehouses = pgTable("warehouses", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  code: varchar("code", { length: 40 }),
  location: varchar("location", { length: 255 }),
  // A warehouse may map to a physical workshop/station (reuse, Plan §4).
  workshopId: uuid("workshop_id").references(() => workshops.id, { onDelete: "set null" }),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("warehouses_ws_code_uq").on(t.workspaceId, t.code)]);

// Current on-hand / committed per product × warehouse (read model over the
// ledger). available = onHand − committed (derived, not stored).
export const stockLevels = pgTable("stock_levels", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "cascade" }),
  onHand: real("on_hand").default(0).notNull(),
  committed: real("committed").default(0).notNull(),
  // Separate "unavailable" buckets (not part of onHand): full BRD §damaged/quarantine.
  damaged: real("damaged").default(0).notNull(),
  quarantine: real("quarantine").default(0).notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("stock_levels_product_warehouse_uq").on(t.productId, t.warehouseId)]);

// Immutable ledger — one row per stock change. Deltas are explicit so the
// level update is a pure increment and the lifecycle (§6.3) is auditable.
export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  warehouseId: uuid("warehouse_id")
    .notNull()
    .references(() => warehouses.id, { onDelete: "cascade" }),
  type: stockMovementTypeEnum("type").notNull(),
  // Signed magnitude (negative for outward/adjustment-down), plus the exact
  // deltas applied to the level so replay/audit needs no re-derivation.
  quantity: real("quantity").notNull(),
  onHandDelta: real("on_hand_delta").default(0).notNull(),
  committedDelta: real("committed_delta").default(0).notNull(),
  // Optional lot/location dimensions (full BRD lot & bin tracking).
  lotId: uuid("lot_id").references((): AnyPgColumn => lots.id, { onDelete: "set null" }),
  locationId: uuid("location_id").references((): AnyPgColumn => locations.id, { onDelete: "set null" }),
  // Source artifact: 'goods_receipt' | 'sales_order' | 'shipment' | 'adjustment' | 'transfer'
  refType: varchar("ref_type", { length: 40 }),
  refId: uuid("ref_id"),
  note: text("note"),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// INVENTORY — full BRD: bins/locations, lot & serial tracking, expiry,
// cycle counting, and FIFO valuation layers. Additive to the stock ledger
// above (damaged/quarantine live as buckets on stock_levels).
// ════════════════════════════════════════════════════════════════════

export const locationKindEnum = pgEnum("location_kind", ["zone", "aisle", "rack", "shelf", "bin"]);
export const lotStatusEnum = pgEnum("lot_status", ["available", "quarantine", "expired", "scrapped"]);
export const serialStatusEnum = pgEnum("serial_status", ["in_stock", "shipped", "scrapped", "quarantine"]);
export const cycleCountStatusEnum = pgEnum("cycle_count_status", ["open", "counted", "posted", "cancelled"]);

// Storage locations within a warehouse (zone → aisle → rack → shelf → bin).
export const locations = pgTable("locations", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 60 }).notNull(),
  name: varchar("name", { length: 255 }),
  kind: locationKindEnum("kind").default("bin").notNull(),
  parentLocationId: uuid("parent_location_id").references((): AnyPgColumn => locations.id, { onDelete: "set null" }),
  isBlocked: boolean("is_blocked").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("locations_wh_code_uq").on(t.warehouseId, t.code)]);

// Lot / batch with expiry (full BRD lot tracking + FEFO).
export const lots = pgTable("lots", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  lotNumber: varchar("lot_number", { length: 120 }).notNull(),
  supplierLotNumber: varchar("supplier_lot_number", { length: 120 }),
  mfgDate: timestamp("mfg_date", { mode: "date" }),
  expiryDate: timestamp("expiry_date", { mode: "date" }),
  receivedDate: timestamp("received_date", { mode: "date" }).defaultNow().notNull(),
  status: lotStatusEnum("status").default("available").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("lots_product_number_uq").on(t.productId, t.lotNumber)]);

// Serial-numbered units (full BRD serial tracking).
export const serials = pgTable("serials", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  serialNumber: varchar("serial_number", { length: 120 }).notNull(),
  lotId: uuid("lot_id").references(() => lots.id, { onDelete: "set null" }),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  status: serialStatusEnum("status").default("in_stock").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("serials_product_number_uq").on(t.productId, t.serialNumber)]);

// FIFO valuation layers — one per receipt, consumed oldest-first on issue.
export const valuationLayers = pgTable("valuation_layers", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
  qtyRemaining: real("qty_remaining").default(0).notNull(),
  unitCostMinor: integer("unit_cost_minor").default(0).notNull(),
  receivedAt: timestamp("received_at", { mode: "date" }).defaultNow().notNull(),
  refType: varchar("ref_type", { length: 40 }),
  refId: uuid("ref_id"),
});

// Cycle count session + lines (system vs counted → variance → adjustment).
export const cycleCounts = pgTable("cycle_counts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  status: cycleCountStatusEnum("status").default("open").notNull(),
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  postedAt: timestamp("posted_at", { mode: "date" }),
});

export const cycleCountLines = pgTable("cycle_count_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  cycleCountId: uuid("cycle_count_id").notNull().references(() => cycleCounts.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  locationId: uuid("location_id").references(() => locations.id, { onDelete: "set null" }),
  systemQty: real("system_qty").default(0).notNull(),
  countedQty: real("counted_qty"),
  position: integer("position").default(0).notNull(),
});

// ════════════════════════════════════════════════════════════════════
// PRODUCT MANAGEMENT (BRD 0X) — engineering data on top of `products`:
// Bills of Materials, revisions, specifications, and engineering change
// requests (ECR). The `products` row stays the master; these add the
// "what it's made of / how it changed" layer that Production consumes.
// ════════════════════════════════════════════════════════════════════

export const bomStatusEnum = pgEnum("bom_status", ["draft", "active", "archived"]);

export const productRevisionStatusEnum = pgEnum("product_revision_status", [
  "draft",
  "released",
  "superseded",
]);

export const ecrStatusEnum = pgEnum("ecr_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "implemented",
]);

// Bill of Materials header — one per product version. Components are bomLines.
export const boms = pgTable("boms", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  version: varchar("version", { length: 40 }).default("v1").notNull(),
  name: varchar("name", { length: 255 }),
  status: bomStatusEnum("status").default("draft").notNull(),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("boms_product_version_uq").on(t.productId, t.version)]);

// One component line of a BOM. `componentProductId` references another product
// (raw material / sub-assembly); `description` is the always-set fallback.
export const bomLines = pgTable("bom_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  bomId: uuid("bom_id")
    .notNull()
    .references(() => boms.id, { onDelete: "cascade" }),
  componentProductId: uuid("component_product_id").references((): AnyPgColumn => products.id, { onDelete: "set null" }),
  description: varchar("description", { length: 255 }),
  quantity: real("quantity").default(1).notNull(),
  unit: varchar("unit", { length: 40 }).default("unit").notNull(),
  scrapPct: real("scrap_pct").default(0).notNull(),
  position: integer("position").default(0).notNull(),
});

// Engineering revision of a product (rev A, B, …). The spec snapshot captures
// the product's specs at release time for traceability.
export const productRevisions = pgTable("product_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  revision: varchar("revision", { length: 40 }).notNull(),
  changeSummary: text("change_summary"),
  status: productRevisionStatusEnum("status").default("draft").notNull(),
  specSnapshot: jsonb("spec_snapshot").$type<Record<string, unknown>>().default({}).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  releasedAt: timestamp("released_at", { mode: "date" }),
}, (t) => [unique("product_revisions_uq").on(t.productId, t.revision)]);

// Normalized product specifications (key/value), e.g. "Material" = "SS 304".
export const productSpecifications = pgTable("product_specifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 120 }).notNull(),
  value: varchar("value", { length: 500 }),
  unit: varchar("unit", { length: 40 }),
  position: integer("position").default(0).notNull(),
});

// Engineering Change Request — governs a proposed change to a product/BOM.
export const engineeringChangeRequests = pgTable("engineering_change_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  number: varchar("number", { length: 60 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  priority: varchar("priority", { length: 20 }).default("normal").notNull(),
  status: ecrStatusEnum("status").default("draft").notNull(),
  requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
  approverId: uuid("approver_id").references(() => users.id, { onDelete: "set null" }),
  decisionNotes: text("decision_notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  decidedAt: timestamp("decided_at", { mode: "date" }),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("ecr_ws_number_uq").on(t.workspaceId, t.number)]);

// ════════════════════════════════════════════════════════════════════
// PRODUCTION / MANUFACTURING (BRD 11) — work orders that consume BOM
// components from inventory and receive finished goods back in. Reuses
// applyStockMovement() so stock invariants and stock.* events are shared.
// ════════════════════════════════════════════════════════════════════

export const workOrderStatusEnum = pgEnum("work_order_status", [
  "planned",
  "released",
  "in_progress",
  "completed",
  "cancelled",
]);

export const workOrders = pgTable("work_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  number: varchar("number", { length: 60 }).notNull(),
  // Finished-good product being manufactured.
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  // The BOM exploded into materials (snapshot copied to work_order_materials).
  bomId: uuid("bom_id").references(() => boms.id, { onDelete: "set null" }),
  // Warehouse components are drawn from and finished goods received into.
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  status: workOrderStatusEnum("status").default("planned").notNull(),
  qtyPlanned: real("qty_planned").default(1).notNull(),
  qtyProduced: real("qty_produced").default(0).notNull(),
  qtyScrapped: real("qty_scrapped").default(0).notNull(),
  dueDate: timestamp("due_date", { mode: "date" }),
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  releasedAt: timestamp("released_at", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
}, (t) => [unique("work_orders_ws_number_uq").on(t.workspaceId, t.number)]);

// Components a work order needs — snapshot from the BOM at creation, scaled by
// the planned quantity. Consumed from stock when the work order completes.
export const workOrderMaterials = pgTable("work_order_materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  workOrderId: uuid("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  componentProductId: uuid("component_product_id").references((): AnyPgColumn => products.id, { onDelete: "set null" }),
  description: varchar("description", { length: 255 }),
  qtyRequired: real("qty_required").default(0).notNull(),
  qtyIssued: real("qty_issued").default(0).notNull(),
  unit: varchar("unit", { length: 40 }).default("unit").notNull(),
  position: integer("position").default(0).notNull(),
});

// ════════════════════════════════════════════════════════════════════
// MAINTENANCE (BRD 12) — asset register + preventive/corrective work orders.
// Spare-part consumption reuses applyStockMovement(); asset "down" status is
// the interlock signal Production consumes.
// ════════════════════════════════════════════════════════════════════

export const assetStatusEnum = pgEnum("asset_status", ["up", "down", "maintenance", "retired"]);
export const maintenanceTypeEnum = pgEnum("maintenance_type", ["corrective", "preventive"]);
export const maintenanceOrderStatusEnum = pgEnum("maintenance_order_status", [
  "open",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
]);

export const assets = pgTable("assets", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 60 }),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 120 }),
  parentAssetId: uuid("parent_asset_id").references((): AnyPgColumn => assets.id, { onDelete: "set null" }),
  location: varchar("location", { length: 255 }),
  status: assetStatusEnum("status").default("up").notNull(),
  criticality: varchar("criticality", { length: 20 }).default("medium").notNull(),
  purchaseDate: timestamp("purchase_date", { mode: "date" }),
  warrantyUntil: timestamp("warranty_until", { mode: "date" }),
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("assets_ws_code_uq").on(t.workspaceId, t.code)]);

// Preventive-maintenance schedule that generates maintenance orders when due.
export const pmSchedules = pgTable("pm_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  basis: varchar("basis", { length: 20 }).default("time").notNull(),
  intervalDays: integer("interval_days").default(0).notNull(),
  checklist: text("checklist"),
  nextDue: timestamp("next_due", { mode: "date" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const maintenanceOrders = pgTable("maintenance_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  number: varchar("number", { length: 60 }).notNull(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id, { onDelete: "cascade" }),
  type: maintenanceTypeEnum("type").default("corrective").notNull(),
  status: maintenanceOrderStatusEnum("status").default("open").notNull(),
  priority: varchar("priority", { length: 20 }).default("normal").notNull(),
  fault: text("fault"),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  scheduledDate: timestamp("scheduled_date", { mode: "date" }),
  downtimeHours: real("downtime_hours").default(0).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { mode: "date" }),
}, (t) => [unique("maintenance_orders_ws_number_uq").on(t.workspaceId, t.number)]);

// Spare parts consumed by a maintenance order (drawn from inventory on complete).
export const maintenanceParts = pgTable("maintenance_parts", {
  id: uuid("id").defaultRandom().primaryKey(),
  maintenanceOrderId: uuid("maintenance_order_id")
    .notNull()
    .references(() => maintenanceOrders.id, { onDelete: "cascade" }),
  partProductId: uuid("part_product_id").references(() => products.id, { onDelete: "set null" }),
  description: varchar("description", { length: 255 }),
  qtyUsed: real("qty_used").default(1).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  position: integer("position").default(0).notNull(),
});

// ════════════════════════════════════════════════════════════════════
// SAFETY / EHS (BRD 13) — incident & near-miss reporting with corrective
// actions. Reuses the same "action → closure" pattern as the quality CAPA
// loop; incidents can reference an asset (Maintenance) or employee.
// ════════════════════════════════════════════════════════════════════

export const incidentTypeEnum = pgEnum("incident_type", [
  "injury",
  "near_miss",
  "property",
  "environmental",
]);
export const incidentSeverityEnum = pgEnum("incident_severity", ["low", "medium", "high", "critical"]);
export const incidentStatusEnum = pgEnum("incident_status", [
  "reported",
  "investigating",
  "actions_open",
  "closed",
]);
export const safetyActionStatusEnum = pgEnum("safety_action_status", ["open", "done"]);

export const incidents = pgTable("incidents", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  number: varchar("number", { length: 60 }).notNull(),
  type: incidentTypeEnum("type").default("near_miss").notNull(),
  severity: incidentSeverityEnum("severity").default("low").notNull(),
  status: incidentStatusEnum("status").default("reported").notNull(),
  occurredAt: timestamp("occurred_at", { mode: "date" }),
  location: varchar("location", { length: 255 }),
  description: text("description"),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
  reportedBy: uuid("reported_by").references(() => users.id, { onDelete: "set null" }),
  investigatorId: uuid("investigator_id").references(() => users.id, { onDelete: "set null" }),
  rootCause: text("root_cause"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  closedAt: timestamp("closed_at", { mode: "date" }),
}, (t) => [unique("incidents_ws_number_uq").on(t.workspaceId, t.number)]);

// Corrective/preventive action raised from an incident (mirrors quality CAPA).
export const safetyActions = pgTable("safety_actions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  incidentId: uuid("incident_id")
    .notNull()
    .references(() => incidents.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  dueDate: timestamp("due_date", { mode: "date" }),
  status: safetyActionStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { mode: "date" }),
});

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 4: Estimates / Quotes (Plan §6.1)
// First-class pre-sale document. Accepted in the Customer Portal (Phase 7) or
// by staff; converts to a sales order (Phase 5) or invoice (Phase 6). No stock
// impact at any estimate stage (Plan §6.3). Versions are immutable snapshots.
// ════════════════════════════════════════════════════════════════════

export const estimateStatusEnum = pgEnum("estimate_status", [
  "draft",
  "sent",
  "viewed",
  "accepted",
  "rejected",
  "expired",
  "converted",
]);

export const estimates = pgTable("estimates", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  status: estimateStatusEnum("status").default("draft").notNull(),
  version: integer("version").default(1).notNull(),
  validUntil: timestamp("valid_until", { mode: "date" }),
  subtotalMinor: integer("subtotal_minor").default(0).notNull(),
  taxMinor: integer("tax_minor").default(0).notNull(),
  totalMinor: integer("total_minor").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  notes: text("notes"),
  // ── Scope ladder (Plan B.4) — links the estimate to a project board/item ──
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  linkLevel: linkLevelEnum("link_level").default("none").notNull(),
  // Default-deny exposure to the customer portal; flipped true on send.
  customerVisible: boolean("customer_visible").default(false).notNull(),
  // Portal acceptance — FK to portal_contacts (Phase 7).
  acceptedByPortalContactId: uuid("accepted_by_portal_contact_id").references((): AnyPgColumn => portalContacts.id, { onDelete: "set null" }),
  acceptedAt: timestamp("accepted_at", { mode: "date" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  // One-way conversion record: 'sales_order' | 'invoice'.
  convertedToType: varchar("converted_to_type", { length: 20 }),
  convertedToId: uuid("converted_to_id"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("estimates_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

export const estimateLineItems = pgTable("estimate_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  estimateId: uuid("estimate_id")
    .notNull()
    .references(() => estimates.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: real("quantity").default(1).notNull(),
  // Unit sell price in minor units (estimates quote prices, not costs).
  unitPriceMinor: integer("unit_price_minor").default(0).notNull(),
  taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
  amountMinor: integer("amount_minor").default(0).notNull(),
  lineTaxMinor: integer("line_tax_minor").default(0).notNull(),
  position: real("position").default(0).notNull(),
});

// Immutable per-revision snapshot (full line JSON + totals), like
// inspections.templateSnapshot — version history is auditable.
export const estimateVersions = pgTable("estimate_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  estimateId: uuid("estimate_id")
    .notNull()
    .references(() => estimates.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  snapshot: jsonb("snapshot").notNull(), // { lines: [...], subtotalMinor, taxMinor, totalMinor, ... }
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("estimate_versions_uq").on(t.estimateId, t.version)]);

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 5: Sales Orders & Fulfillment (Plan §6.2 / §6.3)
// Order-to-ship lifecycle. Approve → reserve (committed+). Ship → deduct
// (onHand− AND committed−) — the SINGLE on-hand deduction for sales. Per-line
// qtyReserved/qtyShipped/qtyInvoiced prevent double reserve/ship/bill, parallel
// to how committed/onHand prevent double stock deduction.
// ════════════════════════════════════════════════════════════════════

export const salesOrderStatusEnum = pgEnum("sales_order_status", [
  "draft",
  "pending_approval",
  "approved",
  "reserved",
  "picking",
  "packed",
  "shipped",
  "delivered",
  "invoiced",
  "cancelled",
]);

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "pending",
  "picked",
  "packed",
  "shipped",
  "delivered",
]);

export const salesOrders = pgTable("sales_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  estimateId: uuid("estimate_id").references(() => estimates.id, { onDelete: "set null" }),
  status: salesOrderStatusEnum("status").default("draft").notNull(),
  // Default warehouse stock is reserved from / shipped out of.
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  subtotalMinor: integer("subtotal_minor").default(0).notNull(),
  taxMinor: integer("tax_minor").default(0).notNull(),
  totalMinor: integer("total_minor").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  notes: text("notes"),
  // Sales full BRD: drop-ship sales orders fulfil via a linked PO, not stock.
  isDropShip: boolean("is_drop_ship").default(false).notNull(),
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  linkLevel: linkLevelEnum("link_level").default("none").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("sales_orders_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

export const salesOrderLineItems = pgTable("sales_order_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  salesOrderId: uuid("sales_order_id")
    .notNull()
    .references(() => salesOrders.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: real("quantity").default(1).notNull(), // ordered
  qtyReserved: real("qty_reserved").default(0).notNull(),
  qtyShipped: real("qty_shipped").default(0).notNull(),
  qtyInvoiced: real("qty_invoiced").default(0).notNull(),
  unitPriceMinor: integer("unit_price_minor").default(0).notNull(),
  taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
  amountMinor: integer("amount_minor").default(0).notNull(),
  lineTaxMinor: integer("line_tax_minor").default(0).notNull(),
  position: real("position").default(0).notNull(),
});

// ════════════════════════════════════════════════════════════════════
// SALES — full BRD: price lists, returns/RMA, recurring orders.
// ════════════════════════════════════════════════════════════════════

export const salesReturnStatusEnum = pgEnum("sales_return_status", ["draft", "posted", "cancelled"]);

export const priceLists = pgTable("price_lists", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const priceListItems = pgTable("price_list_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  priceListId: uuid("price_list_id").notNull().references(() => priceLists.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  unitPriceMinor: integer("unit_price_minor").default(0).notNull(),
}, (t) => [unique("price_list_items_uq").on(t.priceListId, t.productId)]);

export const salesReturns = pgTable("sales_returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  status: salesReturnStatusEnum("status").default("draft").notNull(),
  reason: varchar("reason", { length: 255 }),
  restock: boolean("restock").default(true).notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  postedAt: timestamp("posted_at", { mode: "date" }),
}, (t) => [unique("sales_returns_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

export const salesReturnLines = pgTable("sales_return_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  salesReturnId: uuid("sales_return_id").notNull().references(() => salesReturns.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  description: varchar("description", { length: 500 }),
  quantity: real("quantity").default(1).notNull(),
  unitPriceMinor: integer("unit_price_minor").default(0).notNull(),
  position: integer("position").default(0).notNull(),
});

// Recurring order template — generates a draft sales order on a cadence.
export const recurringOrders = pgTable("recurring_orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  cadence: varchar("cadence", { length: 20 }).default("monthly").notNull(),
  nextRunDate: timestamp("next_run_date", { mode: "date" }),
  isActive: boolean("is_active").default(true).notNull(),
  template: jsonb("template").$type<{ lines: { productId?: string; description: string; quantity: number; unitPrice: number }[] }>().default({ lines: [] }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  salesOrderId: uuid("sales_order_id")
    .notNull()
    .references(() => salesOrders.id, { onDelete: "cascade" }),
  docNumber: varchar("doc_number", { length: 50 }),
  status: shipmentStatusEnum("status").default("pending").notNull(),
  carrier: varchar("carrier", { length: 120 }),
  tracking: varchar("tracking", { length: 120 }),
  shippedAt: timestamp("shipped_at", { mode: "date" }),
  deliveredAt: timestamp("delivered_at", { mode: "date" }),
  shippedBy: uuid("shipped_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const shipmentLines = pgTable("shipment_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  shipmentId: uuid("shipment_id")
    .notNull()
    .references(() => shipments.id, { onDelete: "cascade" }),
  salesOrderLineId: uuid("sales_order_line_id")
    .notNull()
    .references(() => salesOrderLineItems.id, { onDelete: "cascade" }),
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  quantity: real("quantity").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 6: Invoicing (Plan §6) — MANUAL PAYMENTS ONLY
// An invoice is a financial document: it references already-shipped quantities
// and NEVER moves stock (Plan §6.3). Payments are offline records — no gateway,
// no card processing (Plan §13). Generated from a sales order / shipment, from
// billable time, or standalone.
// ════════════════════════════════════════════════════════════════════

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "partially_paid",
  "paid",
  "overdue",
  "void",
]);

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  // AR invoice → customerId; AP bill → vendorId (kind = 'ar' | 'ap').
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "restrict" }),
  kind: varchar("kind", { length: 2 }).default("ar").notNull(),
  vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, { onDelete: "set null" }),
  issueDate: timestamp("issue_date", { mode: "date" }).defaultNow().notNull(),
  dueDate: timestamp("due_date", { mode: "date" }),
  subtotalMinor: integer("subtotal_minor").default(0).notNull(),
  taxMinor: integer("tax_minor").default(0).notNull(),
  totalMinor: integer("total_minor").default(0).notNull(),
  amountPaidMinor: integer("amount_paid_minor").default(0).notNull(),
  // Full BRD: write-off + multi-currency FX rate (to workspace base currency).
  writeOffMinor: integer("write_off_minor").default(0).notNull(),
  fxRate: real("fx_rate").default(1).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  notes: text("notes"),
  // Default-deny portal exposure; flipped true on send.
  customerVisible: boolean("customer_visible").default(false).notNull(),
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  linkLevel: linkLevelEnum("link_level").default("none").notNull(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("invoices_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

// ════════════════════════════════════════════════════════════════════
// INVOICING & BOOKS — full BRD: credit notes, recurring invoices, dunning,
// and double-entry accounting (chart of accounts + journals → trial balance).
// ════════════════════════════════════════════════════════════════════

export const accountTypeEnum = pgEnum("account_type", ["asset", "liability", "equity", "income", "expense"]);
export const journalStatusEnum = pgEnum("journal_status", ["draft", "posted"]);
export const creditNoteStatusEnum = pgEnum("credit_note_status", ["draft", "issued", "applied"]);

export const creditNotes = pgTable("credit_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  status: creditNoteStatusEnum("status").default("draft").notNull(),
  amountMinor: integer("amount_minor").default(0).notNull(),
  reason: varchar("reason", { length: 255 }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  appliedAt: timestamp("applied_at", { mode: "date" }),
}, (t) => [unique("credit_notes_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

// Chart of accounts (named ledgerAccounts to avoid the NextAuth `accounts` table).
export const ledgerAccounts = pgTable("ledger_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: accountTypeEnum("type").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("ledger_accounts_ws_code_uq").on(t.workspaceId, t.code)]);

// Double-entry journal entries (header + balanced lines).
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  entryDate: timestamp("entry_date", { mode: "date" }).defaultNow().notNull(),
  memo: varchar("memo", { length: 500 }),
  status: journalStatusEnum("status").default("draft").notNull(),
  sourceType: varchar("source_type", { length: 40 }),
  sourceId: uuid("source_id"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  postedAt: timestamp("posted_at", { mode: "date" }),
}, (t) => [unique("journal_entries_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

export const journalLines = pgTable("journal_lines", {
  id: uuid("id").defaultRandom().primaryKey(),
  journalEntryId: uuid("journal_entry_id").notNull().references(() => journalEntries.id, { onDelete: "cascade" }),
  accountId: uuid("account_id").notNull().references(() => ledgerAccounts.id, { onDelete: "restrict" }),
  debitMinor: integer("debit_minor").default(0).notNull(),
  creditMinor: integer("credit_minor").default(0).notNull(),
  memo: varchar("memo", { length: 255 }),
  position: integer("position").default(0).notNull(),
});

export const recurringInvoices = pgTable("recurring_invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  cadence: varchar("cadence", { length: 20 }).default("monthly").notNull(),
  nextRunDate: timestamp("next_run_date", { mode: "date" }),
  isActive: boolean("is_active").default(true).notNull(),
  template: jsonb("template").$type<{ lines: { description: string; quantity: number; unitPrice: number }[] }>().default({ lines: [] }).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const dunningLog = pgTable("dunning_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
  level: integer("level").default(1).notNull(),
  channel: varchar("channel", { length: 20 }).default("email").notNull(),
  sentAt: timestamp("sent_at", { mode: "date" }).defaultNow().notNull(),
});

export const invoiceLineItems = pgTable("invoice_line_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  // Optional source provenance (Plan §6) — any may be set.
  productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
  timeLogId: uuid("time_log_id").references(() => timeLogs.id, { onDelete: "set null" }),
  salesOrderLineId: uuid("sales_order_line_id").references(() => salesOrderLineItems.id, { onDelete: "set null" }),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: real("quantity").default(1).notNull(),
  unitPriceMinor: integer("unit_price_minor").default(0).notNull(),
  taxRateId: uuid("tax_rate_id").references(() => taxRates.id, { onDelete: "set null" }),
  amountMinor: integer("amount_minor").default(0).notNull(),
  lineTaxMinor: integer("line_tax_minor").default(0).notNull(),
  position: real("position").default(0).notNull(),
});

// Manual/offline payments only — NO gateway, NO card processing (Plan §13).
export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  amountMinor: integer("amount_minor").notNull(),
  // 'cash' | 'cheque' | 'bank_transfer' | 'other' — descriptive only.
  method: varchar("method", { length: 30 }).default("other").notNull(),
  reference: varchar("reference", { length: 120 }),
  receivedDate: timestamp("received_date", { mode: "date" }).defaultNow().notNull(),
  note: text("note"),
  recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 7: Customer Portal (Plan §6.5)
// A SEPARATE identity plane: portal contacts authenticate only into /portal,
// never the staff /dashboard or staff APIs. Every portal query is filtered by
// the session's customerId AND workspaceId; default-deny via `customerVisible`
// flags on shareable artifacts. Portal contacts are excluded from
// workspaceMembers and staff nav. (Plan §13 portal isolation.)
// ════════════════════════════════════════════════════════════════════

export const portalContacts = pgTable("portal_contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  status: partyStatusEnum("status").default("active").notNull(),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("portal_contacts_ws_email_uq").on(t.workspaceId, t.email)]);

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 8: Expense Management (Plan §7) — MANUAL REIMBURSE
// Reuses `employees` and the generic approval engine. Submit → approval engine
// (subjectType 'expense') → runApprovalSubjectSync flips status. Reimbursement
// is a manual/offline record (no gateway, Plan §13).
// ════════════════════════════════════════════════════════════════════

export const expenseStatusEnum = pgEnum("expense_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "reimbursed",
]);

export const expenseCategories = pgTable("expense_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  // Policy engine (full BRD): per-category spend limit + receipt threshold.
  maxAmountMinor: integer("max_amount_minor").default(0).notNull(),
  receiptRequiredAboveMinor: integer("receipt_required_above_minor").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("expense_categories_ws_name_uq").on(t.workspaceId, t.name)]);

// Cash advances — requested, approved, then settled against expenses.
export const expenseAdvances = pgTable("expense_advances", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "restrict" }),
  amountMinor: integer("amount_minor").default(0).notNull(),
  settledMinor: integer("settled_minor").default(0).notNull(),
  status: varchar("status", { length: 20 }).default("requested").notNull(),
  note: varchar("note", { length: 255 }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("expense_advances_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

// Corporate-card transactions imported for matching to expenses.
export const cardTransactions = pgTable("card_transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  postedDate: timestamp("posted_date", { mode: "date" }),
  description: varchar("description", { length: 255 }),
  amountMinor: integer("amount_minor").default(0).notNull(),
  last4: varchar("last4", { length: 4 }),
  status: varchar("status", { length: 20 }).default("unmatched").notNull(),
  matchedExpenseId: uuid("matched_expense_id"),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  docNumber: varchar("doc_number", { length: 50 }).notNull(),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "restrict" }),
  categoryId: uuid("category_id").references(() => expenseCategories.id, { onDelete: "set null" }),
  vendorId: uuid("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
  amountMinor: integer("amount_minor").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  spentAt: timestamp("spent_at", { mode: "date" }).defaultNow().notNull(),
  description: text("description"),
  receiptFilePath: text("receipt_file_path"),
  status: expenseStatusEnum("status").default("draft").notNull(),
  // Expenses full BRD: type (general/mileage/per-diem), policy violation flag,
  // cost-centre, billable re-invoice link, advance settlement, card match.
  kind: varchar("kind", { length: 20 }).default("general").notNull(),
  mileageDistance: real("mileage_distance").default(0).notNull(),
  mileageRateMinor: integer("mileage_rate_minor").default(0).notNull(),
  costCentre: varchar("cost_centre", { length: 120 }),
  billable: boolean("billable").default(false).notNull(),
  billedInvoiceId: uuid("billed_invoice_id").references((): AnyPgColumn => invoices.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
  policyViolation: boolean("policy_violation").default(false).notNull(),
  advanceId: uuid("advance_id").references(() => expenseAdvances.id, { onDelete: "set null" }),
  cardTransactionId: uuid("card_transaction_id").references(() => cardTransactions.id, { onDelete: "set null" }),
  // Billable expenses link to a project board/item (roll up into 360°).
  boardId: uuid("board_id").references(() => boards.id, { onDelete: "set null" }),
  groupId: uuid("group_id").references(() => groups.id, { onDelete: "set null" }),
  itemId: uuid("item_id").references(() => items.id, { onDelete: "set null" }),
  linkLevel: linkLevelEnum("link_level").default("none").notNull(),
  // Manual reimbursement record.
  reimbursedAt: timestamp("reimbursed_at", { mode: "date" }),
  reimburseMethod: varchar("reimburse_method", { length: 30 }),
  reimburseReference: varchar("reimburse_reference", { length: 120 }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("expenses_ws_docnum_uq").on(t.workspaceId, t.docNumber)]);

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 9: HR + Leave (Plan §8)
// Extends `employees` (the master record). Leave approval = the generic
// approval engine (subjectType 'leave_request'); runApprovalSubjectSync flips
// the request status and rolls the balance.
// ════════════════════════════════════════════════════════════════════

export const departments = pgTable("departments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  // Optional department head (an employee).
  headEmployeeId: uuid("head_employee_id").references(() => employees.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("departments_ws_name_uq").on(t.workspaceId, t.name)]);

export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  // Default annual entitlement (days) used when seeding balances.
  defaultDays: real("default_days").default(0).notNull(),
  isPaid: boolean("is_paid").default(true).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("leave_types_ws_name_uq").on(t.workspaceId, t.name)]);

export const leaveBalances = pgTable("leave_balances", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  leaveTypeId: uuid("leave_type_id")
    .notNull()
    .references(() => leaveTypes.id, { onDelete: "cascade" }),
  periodYear: integer("period_year").notNull(),
  entitledDays: real("entitled_days").default(0).notNull(),
  takenDays: real("taken_days").default(0).notNull(), // remaining = entitled − taken
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("leave_balances_uq").on(t.employeeId, t.leaveTypeId, t.periodYear)]);

export const leaveStatusEnum = pgEnum("leave_status", ["pending", "approved", "rejected", "cancelled"]);

export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  leaveTypeId: uuid("leave_type_id")
    .notNull()
    .references(() => leaveTypes.id, { onDelete: "restrict" }),
  startDate: timestamp("start_date", { mode: "date" }).notNull(),
  endDate: timestamp("end_date", { mode: "date" }).notNull(),
  days: real("days").notNull(),
  reason: text("reason"),
  status: leaveStatusEnum("status").default("pending").notNull(),
  coveringEmployeeId: uuid("covering_employee_id").references(() => employees.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════
// BUSINESS-OPS — Phase 10: Training, Courses & Certification (Plan §9)
// Reuses `employees` (learners), `sops`/storage (material), `signDocuments`
// (certificates). Completion → course.completed → runCertificationIssue mints
// a certification_record; an expiry cron flips records to expiring/expired.
// ════════════════════════════════════════════════════════════════════

export const enrollmentStatusEnum = pgEnum("enrollment_status", ["enrolled", "in_progress", "completed"]);
export const certStatusEnum = pgEnum("cert_status", ["valid", "expiring", "expired"]);

export const courses = pgTable("courses", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 120 }),
  isPublished: boolean("is_published").default(false).notNull(),
  // Optionally required for everyone in a department (compliance training).
  requiredForDepartmentId: uuid("required_for_department_id").references(() => departments.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const lessons = pgTable("lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 255 }).notNull(),
  // 'text' | 'video' | 'sop' | 'file' — content lives in the matching column.
  contentType: varchar("content_type", { length: 20 }).default("text").notNull(),
  contentText: text("content_text"),
  contentUrl: text("content_url"),
  sopId: uuid("sop_id").references(() => sops.id, { onDelete: "set null" }),
  position: real("position").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const enrollments = pgTable("enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  status: enrollmentStatusEnum("status").default("enrolled").notNull(),
  progressPct: integer("progress_pct").default(0).notNull(),
  assignedAt: timestamp("assigned_at", { mode: "date" }).defaultNow().notNull(),
  dueDate: timestamp("due_date", { mode: "date" }),
  completedAt: timestamp("completed_at", { mode: "date" }),
}, (t) => [unique("enrollments_course_employee_uq").on(t.courseId, t.employeeId)]);

export const lessonProgress = pgTable("lesson_progress", {
  id: uuid("id").defaultRandom().primaryKey(),
  enrollmentId: uuid("enrollment_id")
    .notNull()
    .references(() => enrollments.id, { onDelete: "cascade" }),
  lessonId: uuid("lesson_id")
    .notNull()
    .references(() => lessons.id, { onDelete: "cascade" }),
  completedAt: timestamp("completed_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("lesson_progress_uq").on(t.enrollmentId, t.lessonId)]);

// Certification definitions (name + validity + optional course prerequisite).
export const certifications = pgTable("certifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // 0 = never expires; otherwise months of validity from issue.
  validityMonths: integer("validity_months").default(0).notNull(),
  // When set, completing this course auto-issues the certification.
  requiresCourseId: uuid("requires_course_id").references(() => courses.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
}, (t) => [unique("certifications_ws_name_uq").on(t.workspaceId, t.name)]);

export const certificationRecords = pgTable("certification_records", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "cascade" }),
  certificationId: uuid("certification_id")
    .notNull()
    .references(() => certifications.id, { onDelete: "cascade" }),
  issuedAt: timestamp("issued_at", { mode: "date" }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }),
  status: certStatusEnum("status").default("valid").notNull(),
  // Issued certificate document (DocSign), if any.
  certificateDocId: uuid("certificate_doc_id").references(() => signDocuments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});
