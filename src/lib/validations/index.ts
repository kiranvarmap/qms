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
