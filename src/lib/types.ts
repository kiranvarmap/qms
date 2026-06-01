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

// Instruction attachment stored on a question
export interface QuestionInstruction {
  text: string;           // written instructions (supports markdown-like text)
  mediaUrl: string;       // URL to image or video
  mediaType: "image" | "video" | "";  // type of media
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
  instructions: QuestionInstruction | null;
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
// PDF TEMPLATE MODULE — Block-based document builder
// ════════════════════════════════════════════════════════════════════

// ── Block types ───────────────────────────────────────────────────
export type PdfBlockType =
  | "header"
  | "info_fields"
  | "text"
  | "questions"
  | "actions"
  | "signatures"
  | "spacer"
  | "divider"
  | "page_break"
  | "footer";

export type FontFamily = "helvetica" | "times" | "courier";
export type TextAlign = "left" | "center" | "right";

export interface PdfBlockBase {
  id: string;
  type: PdfBlockType;
}

export interface HeaderBlock extends PdfBlockBase {
  type: "header";
  titleSource: "template_name" | "custom";
  customTitle: string;
  showStatusBadge: boolean;
  bgColor: string;
  textColor: string;
  fontSize: number;
  fontFamily: FontFamily;
  alignment: TextAlign;
  companyName: string;
  companyNameColor: string;
  companyNameSize: number;
  logoUrl: string;
  logoPosition: "left" | "center" | "right";
  logoMaxHeight: number;
}

export interface InfoFieldsBlock extends PdfBlockBase {
  type: "info_fields";
  fields: {
    key: "site" | "conductor" | "started" | "completed" | "ncr" | "score";
    label: string;
    enabled: boolean;
  }[];
  layout: "vertical" | "two_column";
  labelColor: string;
  valueColor: string;
  fontSize: number;
  fontFamily: FontFamily;
}

export interface TextBlock extends PdfBlockBase {
  type: "text";
  content: string;
  fontSize: number;
  fontFamily: FontFamily;
  color: string;
  bold: boolean;
  italic: boolean;
  alignment: TextAlign;
  bgColor: string;
}

export interface QuestionTypeStyle {
  label: string;
  questionColor: string;
  questionFontSize: number;
  answerColor: string;
  answerFontSize: number;
  bgColor: string;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  yes_no_na: "Yes / No / N/A",
  text: "Text",
  long_text: "Long Text",
  number: "Number",
  checkbox: "Checkbox",
  date: "Date",
  photo: "Photo",
  dropdown: "Dropdown",
  multiple_choice: "Multiple Choice",
  multiple_selection: "Multiple Selection",
  rating: "Rating",
  signature: "Signature",
  table: "Table",
  document_number: "Document Number",
  site_name: "Site Name",
  asset_name: "Asset Name",
  company_name: "Company Name",
};

export function buildDefaultQuestionTypeStyles(): Record<QuestionType, QuestionTypeStyle> {
  const types = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];
  const styles = {} as Record<QuestionType, QuestionTypeStyle>;
  for (const t of types) {
    styles[t] = {
      label: QUESTION_TYPE_LABELS[t],
      questionColor: "#000000",
      questionFontSize: 9,
      answerColor: "#666666",
      answerFontSize: 9,
      bgColor: "",
    };
  }
  return styles;
}

export interface QuestionsBlock extends PdfBlockBase {
  type: "questions";
  showSectionHeaders: boolean;
  showSectionNumbers: boolean;
  showQuestionNumbers: boolean;
  showFlags: boolean;
  showNotes: boolean;
  showEmptyQuestions: boolean;
  sectionHeaderBg: string;
  sectionHeaderColor: string;
  sectionFontSize: number;
  questionFontSize: number;
  questionColor: string;
  answerFontSize: number;
  answerColor: string;
  fontFamily: FontFamily;
  flagColor: string;
  noteColor: string;
  dividerColor: string;
  dividerThickness: number;
  questionTypeStyles: Record<QuestionType, QuestionTypeStyle>;
}

export interface ActionsBlock extends PdfBlockBase {
  type: "actions";
  headerText: string;
  headerBg: string;
  headerColor: string;
  fontSize: number;
  fontFamily: FontFamily;
}

export interface SignaturesBlock extends PdfBlockBase {
  type: "signatures";
  headerText: string;
  headerBg: string;
  headerColor: string;
  fontSize: number;
}

export interface SpacerBlock extends PdfBlockBase {
  type: "spacer";
  height: number;
}

export interface DividerBlock extends PdfBlockBase {
  type: "divider";
  color: string;
  thickness: number;
}

export interface PageBreakBlock extends PdfBlockBase {
  type: "page_break";
}

export interface FooterBlock extends PdfBlockBase {
  type: "footer";
  showPageNumbers: boolean;
  showTitle: boolean;
  leftText: string;
  rightText: string;
  fontSize: number;
  color: string;
  logoUrl: string;
  logoPosition: "left" | "center" | "right";
  logoMaxHeight: number;
}

export type PdfBlock =
  | HeaderBlock
  | InfoFieldsBlock
  | TextBlock
  | QuestionsBlock
  | ActionsBlock
  | SignaturesBlock
  | SpacerBlock
  | DividerBlock
  | PageBreakBlock
  | FooterBlock;

export interface PdfTemplateConfig {
  pageSize: "letter" | "a4";
  orientation: "portrait" | "landscape";
  margins: { top: number; right: number; bottom: number; left: number };
  blocks: PdfBlock[];
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

export const DEFAULT_PDF_BLOCKS: PdfBlock[] = [
  {
    id: "hdr",
    type: "header",
    titleSource: "template_name",
    customTitle: "",
    showStatusBadge: true,
    bgColor: "#264D99",
    textColor: "#FFFFFF",
    fontSize: 14,
    fontFamily: "helvetica",
    alignment: "left",
    companyName: "",
    companyNameColor: "#666666",
    companyNameSize: 10,
    logoUrl: "",
    logoPosition: "left",
    logoMaxHeight: 40,
  },
  {
    id: "info",
    type: "info_fields",
    fields: [
      { key: "site", label: "Site", enabled: true },
      { key: "conductor", label: "Conducted By", enabled: true },
      { key: "started", label: "Started", enabled: true },
      { key: "completed", label: "Completed", enabled: true },
      { key: "ncr", label: "NCR Number", enabled: true },
      { key: "score", label: "Score", enabled: true },
    ],
    layout: "two_column",
    labelColor: "#666666",
    valueColor: "#000000",
    fontSize: 9,
    fontFamily: "helvetica",
  },
  { id: "d1", type: "divider", color: "#DDDDDD", thickness: 0.5 },
  {
    id: "qst",
    type: "questions",
    showSectionHeaders: true,
    showSectionNumbers: true,
    showQuestionNumbers: true,
    showFlags: true,
    showNotes: true,
    showEmptyQuestions: false,
    sectionHeaderBg: "#EDEDF3",
    sectionHeaderColor: "#264D99",
    sectionFontSize: 10,
    questionFontSize: 9,
    questionColor: "#000000",
    answerFontSize: 9,
    answerColor: "#666666",
    fontFamily: "helvetica",
    flagColor: "#BF2626",
    noteColor: "#666666",
    dividerColor: "#CCCCCC",
    dividerThickness: 1,
    questionTypeStyles: buildDefaultQuestionTypeStyles(),
  },
  {
    id: "act",
    type: "actions",
    headerText: "CORRECTIVE ACTIONS",
    headerBg: "#FFF2E5",
    headerColor: "#BF2626",
    fontSize: 9,
    fontFamily: "helvetica",
  },
  {
    id: "sig",
    type: "signatures",
    headerText: "SIGNATURES",
    headerBg: "#EDF5ED",
    headerColor: "#278C33",
    fontSize: 9,
  },
  {
    id: "ftr",
    type: "footer",
    showPageNumbers: true,
    showTitle: true,
    leftText: "",
    rightText: "Private & confidential",
    fontSize: 8,
    color: "#666666",
    logoUrl: "",
    logoPosition: "left",
    logoMaxHeight: 20,
  },
];

export const DEFAULT_PDF_CONFIG: PdfTemplateConfig = {
  pageSize: "letter",
  orientation: "portrait",
  margins: { top: 50, right: 50, bottom: 50, left: 50 },
  blocks: DEFAULT_PDF_BLOCKS,
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
