// Shared types for the project management module
export interface BoardMember {
  userId: string;
  role: string;
  name: string | null;
  email: string;
  image: string | null;
}

export interface ColumnDef {
  id: string;
  boardId: string;
  name: string;
  type: string;
  position: number;
  width: number;
  config: Record<string, unknown>;
  createdAt: string;
}

export interface GroupDef {
  id: string;
  boardId: string;
  name: string;
  color: string;
  position: number;
  collapsed: boolean;
  createdAt: string;
}

export interface CellValue {
  textValue: string | null;
  numberValue: number | null;
  booleanValue: boolean | null;
  dateValue: string | null;
  jsonValue: unknown;
}

export interface ItemDef {
  id: string;
  boardId: string;
  groupId: string;
  name: string;
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  values: Record<string, CellValue>;
}

export interface BoardData {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  color: string;
  groups: GroupDef[];
  columns: ColumnDef[];
  items: ItemDef[];
  members: BoardMember[];
}

export interface LabelConfig {
  id: string;
  text: string;
  color: string;
}

// ════════════════════════════════════════════════════════════════════
// INSPECTIONS MODULE
// ════════════════════════════════════════════════════════════════════

export type QuestionType =
  | "yes_no_na"
  | "text"
  | "long_text"
  | "number"
  | "checkbox"
  | "date"
  | "photo"
  | "dropdown"
  | "multiple_choice"
  | "multiple_selection"
  | "rating"
  | "signature"
  | "table"
  | "document_number"
  | "site_name"
  | "asset_name"
  | "company_name";

export interface QuestionOption {
  id: string;
  text: string;
  score?: number;   // per-option scoring (positive, negative, or zero)
  flagged?: boolean; // auto-flag when this option is selected
}

// Table field column definition (stored in question options for type="table")
export interface TableColumnDef {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "quick_response";
}

// Conditional logic rule stored on a question
export interface ConditionalRule {
  condition: {
    questionId: string;
    operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "is_answered" | "is_not_answered";
    value?: unknown;
  };
  action: {
    type: "show" | "hide" | "skip_to" | "require_note" | "require_media" | "notify";
    config?: Record<string, unknown>; // e.g. { questionId } for skip_to, { userIds } for notify
  };
}

// Flag rules stored on a question
export interface FlagRules {
  values: string[];   // answer values that trigger auto-flag
  autoFlag: boolean;
}

export interface TemplateQuestion {
  id: string;
  sectionId: string;
  title: string;
  description: string | null;
  type: QuestionType;
  required: boolean;
  scoring: boolean;
  weight: number;
  options: QuestionOption[];
  position: number;
  conditionalRules: ConditionalRule[] | null;
  flagRules: FlagRules | null;
  linkedQuestionId: string | null;
}

export interface TemplateSection {
  id: string;
  templateId: string;
  title: string;
  position: number;
  pageNumber: number;
  isRepeatable: boolean;
  maxRepetitions: number | null;
  requiresSignoff: boolean;
  signoffRoles: string[] | null;
  questions: TemplateQuestion[];
}

export interface InspectionTemplate {
  id: string;
  title: string;
  description: string | null;
  isPublished: boolean;
  scoringEnabled: boolean;
  boardId: string | null;
  workspaceId: string | null;
  isNcr: boolean;
  ncrDocNumberFormat: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  sections: TemplateSection[];
  pdfTemplateId: string | null;
  boardName?: string | null;
  _count?: { inspections: number };
}

export interface InspectionResponse {
  id: string;
  inspectionId: string;
  questionId: string;
  sectionId: string;
  repeatIndex: number;
  value: unknown;
  flagged: boolean;
  note: string | null;
  updatedAt: string;
}

export interface InspectionAction {
  id: string;
  inspectionId: string;
  questionId: string | null;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  assignedTo: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface Inspection {
  id: string;
  templateId: string;
  templateSnapshot: { sections: TemplateSection[]; scoringEnabled: boolean };
  title: string;
  site: string | null;
  conductedBy: string;
  conductedByName: string | null;
  status: "in_progress" | "pending_review" | "completed";
  score: number | null;
  ncrNumber: string | null;
  startedAt: string;
  completedAt: string | null;
  createdAt: string;
  responses: InspectionResponse[];
  actions: InspectionAction[];
  signatures?: InspectionSignature[];
  linkedItemId?: string | null;
  linkedItemName?: string | null;
}

// ── Inspection Signatures ──────────────────────────────────────────

export interface InspectionSignature {
  id: string;
  inspectionId: string;
  sectionId: string;
  questionId: string | null;
  employeeId: string;
  signatureData: string; // base64 PNG
  employeeName: string;
  employeeBadgeId: string;
  role: string;
  signedAt: string;
  isVoided: boolean;
  voidedBy: string | null;
  voidedAt: string | null;
  voidReason: string | null;
}

// ── Inspection Audit Log ───────────────────────────────────────────

export type InspectionAuditAction =
  | "created"
  | "viewed"
  | "response_updated"
  | "signature_added"
  | "signature_voided"
  | "submitted"
  | "status_changed"
  | "exported";

export interface InspectionAuditEvent {
  id: string;
  inspectionId: string;
  userId: string | null;
  userName?: string | null;
  action: InspectionAuditAction;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

// ════════════════════════════════════════════════════════════════════
// PDF TEMPLATE MODULE
// ════════════════════════════════════════════════════════════════════

export interface PdfTemplateConfig {
  pageSize: "letter" | "a4";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  colors: {
    primary: string;   // hex e.g. "#264D99"
    accent: string;
    headerBg: string;
    headerText: string;
  };
  header: {
    showTitle: boolean;
    showStatus: boolean;
    showDate: boolean;
    showScore: boolean;
    showSite: boolean;
    showConductor: boolean;
    showNcr: boolean;
    companyName: string;
  };
  sections: {
    showSectionNumbers: boolean;
    showQuestionNumbers: boolean;
  };
  content: {
    showFlags: boolean;
    showNotes: boolean;
    showActions: boolean;
    showSignatures: boolean;
    showEmptyQuestions: boolean;
  };
  footer: {
    showPageNumbers: boolean;
    showConfidential: boolean;
    customText: string;
  };
}

export interface PdfTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  config: PdfTemplateConfig;
  workspaceId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PDF_CONFIG: PdfTemplateConfig = {
  pageSize: "letter",
  orientation: "portrait",
  margins: { top: 50, right: 50, bottom: 50, left: 50 },
  colors: {
    primary: "#264D99",
    accent: "#1A8C33",
    headerBg: "#264D99",
    headerText: "#FFFFFF",
  },
  header: {
    showTitle: true,
    showStatus: true,
    showDate: true,
    showScore: true,
    showSite: true,
    showConductor: true,
    showNcr: true,
    companyName: "",
  },
  sections: {
    showSectionNumbers: true,
    showQuestionNumbers: true,
  },
  content: {
    showFlags: true,
    showNotes: true,
    showActions: true,
    showSignatures: true,
    showEmptyQuestions: false,
  },
  footer: {
    showPageNumbers: true,
    showConfidential: true,
    customText: "",
  },
};

// ════════════════════════════════════════════════════════════════════
// EMPLOYEE MANAGEMENT MODULE
// ════════════════════════════════════════════════════════════════════

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  designation: string | null;
  joiningDate: string | null;
  avatarUrl: string | null;
  status: "active" | "inactive" | "on_leave";
  createdAt: string;
  updatedAt: string;
}

export interface Workshop {
  id: string;
  name: string;
  location: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface EmpProject {
  id: string;
  name: string;
  description: string | null;
  workshopId: string | null;
  workshopName: string | null;
  status: "active" | "completed" | "on_hold";
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  tasks?: EmpTask[];
}

export interface EmpTask {
  id: string;
  projectId: string;
  projectName?: string;
  name: string;
  description: string | null;
  estimatedMinutes: number | null;
  status: "active" | "completed" | "on_hold";
  position: number;
  createdAt: string;
}

export interface TimeLog {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  workshopId: string | null;
  workshopName: string | null;
  projectId: string | null;
  projectName: string | null;
  taskId: string | null;
  taskName: string | null;
  checkInAt: string;
  checkInPhoto: string | null;
  checkOutAt: string | null;
  checkOutPhoto: string | null;
  durationMinutes: number | null;
  notes: string | null;
  status: "active" | "completed";
  createdAt: string;
}

export interface EmployeeReport {
  employee: Employee;
  totalMinutes: number;
  totalSessions: number;
  activeSessions: number;
  logs: TimeLog[];
}

export interface ProjectReport {
  project: EmpProject;
  totalMinutes: number;
  totalSessions: number;
  uniqueEmployees: number;
  taskBreakdown: { task: EmpTask; totalMinutes: number; sessions: number }[];
}

export interface WorkshopReport {
  workshop: Workshop;
  totalMinutes: number;
  totalSessions: number;
  uniqueEmployees: number;
  projectBreakdown: { project: EmpProject; totalMinutes: number }[];
}

// ── Document Signing ───────────────────────────────────────────────

export type SignDocumentStatus = "draft" | "pending" | "completed" | "voided" | "declined";
export type SignRecipientStatus = "pending" | "viewed" | "signed" | "declined";
export type SignFieldType = "signature" | "initials" | "date" | "text" | "checkbox";

export interface SignDocument {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  message: string | null;
  status: SignDocumentStatus;
  createdBy: string | null;
  dueDate: string | null;
  pageCount: number;
  completedAt: string | null;
  completedFilePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SignRecipient {
  id: string;
  documentId: string;
  name: string;
  email: string;
  role: string;
  order: number;
  status: SignRecipientStatus;
  token: string;
  color: string;
  signedAt: string | null;
  declineReason: string | null;
  createdAt: string;
}

export interface SignField {
  id: string;
  documentId: string;
  recipientId: string | null;
  type: SignFieldType;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  label: string | null;
  value: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface SignEvent {
  id: string;
  documentId: string;
  recipientId: string | null;
  eventType: string;
  description: string | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface SignDocumentDetail extends SignDocument {
  recipients: SignRecipient[];
  fields: SignField[];
  events: SignEvent[];
  creatorName?: string | null;
}
