import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  pgEnum,
  boolean,
  primaryKey,
  integer,
  jsonb,
  real,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

// ── Enums ──────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "manager",
  "user",
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
  // Link to employee record (set when user is connected to an employee)
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "set null" }),
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
  name: varchar("name", { length: 500 }).notNull(),
  position: real("position").default(0).notNull(),
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
  conductedBy: uuid("conducted_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // in_progress | pending_review | completed
  status: varchar("status", { length: 20 }).default("in_progress").notNull(),
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
  employeeId: varchar("employee_id", { length: 50 }).notNull().unique(), // Badge / HR code
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  department: varchar("department", { length: 100 }),
  designation: varchar("designation", { length: 100 }),
  joiningDate: timestamp("joining_date", { mode: "date" }),
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
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

// Projects for employee time-tracking (separate from PM boards)
export const empProjects = pgTable("emp_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
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
  workshopId: uuid("workshop_id").references(() => workshops.id, {
    onDelete: "set null",
  }),
  projectId: uuid("project_id").references(() => empProjects.id, {
    onDelete: "set null",
  }),
  taskId: uuid("task_id").references(() => empTasks.id, {
    onDelete: "set null",
  }),
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
