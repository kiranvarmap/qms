/**
 * Document numbering (Plan §2.2).
 *
 * One generalized sequence generator (replacing the per-item ncrSequences
 * pattern) keyed by (workspace, docType, scopeId?). `nextDocNumber` atomically
 * bumps the counter and renders the formatted number. Call it with the SAME
 * executor (`tx`) as the producing write so the number is reserved exactly
 * once, even under concurrency (INSERT … ON CONFLICT DO UPDATE … RETURNING).
 */

import { db } from "@/lib/db";
import { documentSequences } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

type Executor = Pick<typeof db, "insert">;

export type DocType =
  | "invoice"
  | "purchase_order"
  | "expense"
  | "estimate"
  | "sales_order"
  | "goods_receipt"
  | "engineering_change_request"
  | "work_order"
  | "maintenance_order"
  | "incident"
  | "purchase_requisition"
  | "purchase_return"
  | "sales_return"
  | "credit_note"
  | "journal_entry"
  | "expense_advance";

export interface NextDocNumberOpts {
  workspaceId: string;
  docType: DocType;
  /** Optional sub-scope (e.g. per-board). Empty = workspace-wide. */
  scopeId?: string;
  /** Defaults used only when the sequence row is first created. */
  prefix?: string;
  format?: string;
  padding?: number;
}

const DEFAULTS: Record<DocType, { prefix: string; format: string }> = {
  invoice: { prefix: "INV-", format: "{PREFIX}{YYYY}-{SEQ}" },
  purchase_order: { prefix: "PO-", format: "{PREFIX}{SEQ}" },
  expense: { prefix: "EXP-", format: "{PREFIX}{SEQ}" },
  estimate: { prefix: "EST-", format: "{PREFIX}{YYYY}-{SEQ}" },
  sales_order: { prefix: "SO-", format: "{PREFIX}{SEQ}" },
  goods_receipt: { prefix: "GRN-", format: "{PREFIX}{SEQ}" },
  engineering_change_request: { prefix: "ECR-", format: "{PREFIX}{SEQ}" },
  work_order: { prefix: "WO-", format: "{PREFIX}{SEQ}" },
  maintenance_order: { prefix: "MO-", format: "{PREFIX}{SEQ}" },
  incident: { prefix: "INC-", format: "{PREFIX}{SEQ}" },
  purchase_requisition: { prefix: "PR-", format: "{PREFIX}{SEQ}" },
  purchase_return: { prefix: "DN-", format: "{PREFIX}{SEQ}" },
  sales_return: { prefix: "RMA-", format: "{PREFIX}{SEQ}" },
  credit_note: { prefix: "CN-", format: "{PREFIX}{YYYY}-{SEQ}" },
  journal_entry: { prefix: "JE-", format: "{PREFIX}{SEQ}" },
  expense_advance: { prefix: "ADV-", format: "{PREFIX}{SEQ}" },
};

function render(format: string, prefix: string, seq: number, padding: number): string {
  const now = new Date();
  return format
    .replace(/\{PREFIX\}/g, prefix)
    .replace(/\{YYYY\}/g, String(now.getUTCFullYear()))
    .replace(/\{YY\}/g, String(now.getUTCFullYear()).slice(-2))
    .replace(/\{MM\}/g, String(now.getUTCMonth() + 1).padStart(2, "0"))
    .replace(/\{SEQ\}/g, String(seq).padStart(padding, "0"));
}

/** Reserve and render the next number for a document type. */
export async function nextDocNumber(executor: Executor, opts: NextDocNumberOpts): Promise<string> {
  const scopeId = opts.scopeId ?? "";
  const defaults = DEFAULTS[opts.docType];
  const prefix = opts.prefix ?? defaults.prefix;
  const format = opts.format ?? defaults.format;
  const padding = opts.padding ?? 4;

  const [row] = await executor
    .insert(documentSequences)
    .values({
      workspaceId: opts.workspaceId,
      docType: opts.docType,
      scopeId,
      prefix,
      format,
      padding,
      lastNumber: 1,
    })
    .onConflictDoUpdate({
      target: [documentSequences.workspaceId, documentSequences.docType, documentSequences.scopeId],
      set: { lastNumber: sql`${documentSequences.lastNumber} + 1`, updatedAt: new Date() },
    })
    .returning();

  return render(row.format, row.prefix, row.lastNumber, row.padding);
}
