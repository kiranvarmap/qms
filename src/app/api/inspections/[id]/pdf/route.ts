import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspections, inspectionResponses, inspectionActions, inspectionSignatures, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { TemplateSection, TemplateQuestion, InspectionResponse, InspectionAction } from "@/lib/types";
import { scoreLabel } from "@/lib/scoring";

export const dynamic = "force-dynamic";

// ── Colours ───────────────────────────────────────────────────────
const BLUE   = rgb(0.15, 0.35, 0.60);
const GRAY   = rgb(0.40, 0.40, 0.40);
const LGRAY  = rgb(0.85, 0.85, 0.85);
const BLACK  = rgb(0, 0, 0);
const WHITE  = rgb(1, 1, 1);
const GREEN  = rgb(0.15, 0.55, 0.20);
const RED    = rgb(0.75, 0.15, 0.15);
const YELLOW = rgb(0.70, 0.55, 0.05);

// ── Layout ────────────────────────────────────────────────────────
const PAGE_W = 612;  // Letter
const PAGE_H = 792;
const MARGIN = 50;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const FOOTER_H = 30;

interface PageCtx {
  doc: Awaited<ReturnType<typeof PDFDocument.create>>;
  page: ReturnType<Awaited<ReturnType<typeof PDFDocument.create>>["addPage"]>;
  y: number;
  pageNum: number;
  totalPages: number;
  fontRegular: Awaited<ReturnType<Awaited<ReturnType<typeof PDFDocument.create>>["embedFont"]>>;
  fontBold: Awaited<ReturnType<Awaited<ReturnType<typeof PDFDocument.create>>["embedFont"]>>;
  title: string;
}

function addPage(ctx: PageCtx): void {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.pageNum++;
  ctx.y = PAGE_H - MARGIN;
}

function ensureSpace(ctx: PageCtx, needed: number): void {
  if (ctx.y - needed < MARGIN + FOOTER_H) {
    drawFooter(ctx);
    addPage(ctx);
  }
}

// ── Drawing helpers ───────────────────────────────────────────────

function drawText(ctx: PageCtx, text: string, x: number, size: number, options?: { color?: typeof BLACK; font?: typeof ctx.fontRegular; maxWidth?: number }) {
  const font = options?.font ?? ctx.fontRegular;
  const color = options?.color ?? BLACK;
  const maxWidth = options?.maxWidth ?? CONTENT_W;

  // Word-wrap
  const words = text.split(/\s+/);
  let line = "";
  const lines: string[] = [];
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  for (const l of lines) {
    ensureSpace(ctx, size + 4);
    ctx.page.drawText(l, { x, y: ctx.y, size, font, color });
    ctx.y -= size + 4;
  }
}

function drawLine(ctx: PageCtx) {
  ctx.page.drawLine({ start: { x: MARGIN, y: ctx.y }, end: { x: PAGE_W - MARGIN, y: ctx.y }, thickness: 0.5, color: LGRAY });
  ctx.y -= 6;
}

function drawFooter(ctx: PageCtx) {
  const text = `Private & confidential  —  ${ctx.pageNum}`;
  const size = 8;
  const w = ctx.fontRegular.widthOfTextAtSize(text, size);
  ctx.page.drawText(text, { x: PAGE_W - MARGIN - w, y: MARGIN - 15, size, font: ctx.fontRegular, color: GRAY });
}

function drawKeyValue(ctx: PageCtx, label: string, value: string, indent = MARGIN) {
  const labelW = ctx.fontBold.widthOfTextAtSize(label, 9);
  ensureSpace(ctx, 14);
  ctx.page.drawText(label, { x: indent, y: ctx.y, size: 9, font: ctx.fontBold, color: GRAY });
  ctx.page.drawText(value, { x: indent + labelW + 6, y: ctx.y, size: 9, font: ctx.fontRegular, color: BLACK });
  ctx.y -= 14;
}

// ── Header block ──────────────────────────────────────────────────

function drawHeader(ctx: PageCtx, data: {
  title: string;
  status: string;
  score: number | null;
  scoringEnabled: boolean;
  site: string | null;
  conductedBy: string | null;
  startedAt: string;
  completedAt: string | null;
  ncrNumber: string | null;
}) {
  // Title bar
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 28, width: CONTENT_W, height: 28, color: BLUE });
  ctx.page.drawText(data.title, { x: MARGIN + 10, y: ctx.y - 20, size: 14, font: ctx.fontBold, color: WHITE });

  // Status badge
  const statusText = data.status.replace("_", " ").toUpperCase();
  const statusW = ctx.fontBold.widthOfTextAtSize(statusText, 8) + 12;
  const badgeColor = data.status === "completed" ? GREEN : data.status === "pending_review" ? YELLOW : GRAY;
  ctx.page.drawRectangle({ x: PAGE_W - MARGIN - statusW - 6, y: ctx.y - 22, width: statusW, height: 16, color: badgeColor, borderColor: badgeColor, borderWidth: 0 });
  ctx.page.drawText(statusText, { x: PAGE_W - MARGIN - statusW, y: ctx.y - 18, size: 8, font: ctx.fontBold, color: WHITE });
  ctx.y -= 40;

  // Info grid
  if (data.site) drawKeyValue(ctx, "Site:", data.site);
  if (data.conductedBy) drawKeyValue(ctx, "Conducted By:", data.conductedBy);
  drawKeyValue(ctx, "Started:", formatDate(data.startedAt));
  if (data.completedAt) drawKeyValue(ctx, "Completed:", formatDate(data.completedAt));
  if (data.ncrNumber) drawKeyValue(ctx, "NCR Number:", data.ncrNumber);

  if (data.scoringEnabled && data.score !== null) {
    const label = scoreLabel(data.score);
    const color = data.score >= 80 ? GREEN : data.score >= 50 ? YELLOW : RED;
    ensureSpace(ctx, 18);
    ctx.page.drawText("Score:", { x: MARGIN, y: ctx.y, size: 9, font: ctx.fontBold, color: GRAY });
    ctx.page.drawText(`${data.score}% — ${label}`, { x: MARGIN + 45, y: ctx.y, size: 11, font: ctx.fontBold, color });
    ctx.y -= 18;
  }

  ctx.y -= 6;
  drawLine(ctx);
}

// ── Section rendering ─────────────────────────────────────────────

function drawSection(ctx: PageCtx, section: TemplateSection, sectionIdx: number, responseMap: Map<string, InspectionResponse>, sectionRepeatCount: number) {
  const sectionNumber = `${sectionIdx + 1}`;

  for (let ri = 0; ri < sectionRepeatCount; ri++) {
    // Section header
    ensureSpace(ctx, 30);
    const sectionTitle = sectionRepeatCount > 1
      ? `${sectionNumber}. ${section.title} (Instance ${ri + 1})`
      : `${sectionNumber}. ${section.title}`;

    ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 16, width: CONTENT_W, height: 18, color: rgb(0.93, 0.93, 0.96) });
    ctx.page.drawText(sectionTitle.toUpperCase(), { x: MARGIN + 8, y: ctx.y - 12, size: 10, font: ctx.fontBold, color: BLUE });
    ctx.y -= 26;

    // Questions
    for (let qi = 0; qi < section.questions.length; qi++) {
      const q = section.questions[qi];
      const key = `${q.id}_${ri}`;
      const resp = responseMap.get(key);
      drawQuestion(ctx, q, resp, `${sectionNumber}.${qi + 1}`);
    }

    ctx.y -= 8;
  }
}

function drawQuestion(ctx: PageCtx, q: TemplateQuestion, resp: InspectionResponse | undefined, number: string) {
  const value = resp?.value;
  const flagged = resp?.flagged;
  const note = resp?.note;

  ensureSpace(ctx, 24);

  // Question label
  const labelText = `${number}. ${q.title}`;
  drawText(ctx, labelText, MARGIN + 8, 9, { font: ctx.fontBold, color: BLACK, maxWidth: CONTENT_W * 0.55 });

  // Answer value — positioned below the label
  const answerStr = formatAnswer(q, value);
  const answerColor = flagged ? RED : GRAY;

  if (flagged) {
    ensureSpace(ctx, 12);
    ctx.page.drawText("⚑ FLAGGED", { x: MARGIN + 8, y: ctx.y, size: 7, font: ctx.fontBold, color: RED });
    ctx.y -= 10;
  }

  drawText(ctx, answerStr, MARGIN + 16, 9, { color: answerColor, maxWidth: CONTENT_W - 24 });

  // Table type — render as grid
  if (q.type === "table" && Array.isArray(value) && value.length > 0) {
    drawTable(ctx, q, value as Record<string, unknown>[]);
  }

  // Note
  if (note) {
    ensureSpace(ctx, 14);
    ctx.page.drawText(`Note: ${note}`, { x: MARGIN + 16, y: ctx.y, size: 8, font: ctx.fontRegular, color: GRAY });
    ctx.y -= 12;
  }

  ctx.y -= 4;
}

function drawTable(ctx: PageCtx, q: TemplateQuestion, rows: Record<string, unknown>[]) {
  const columns = (q.options as unknown as { columns?: { id: string; name: string }[] })?.columns ?? [];
  if (!columns.length) return;

  const colW = Math.min(120, (CONTENT_W - 16) / columns.length);
  const startX = MARGIN + 8;

  // Header row
  ensureSpace(ctx, 16);
  for (let c = 0; c < columns.length; c++) {
    const x = startX + c * colW;
    ctx.page.drawRectangle({ x, y: ctx.y - 10, width: colW, height: 14, color: rgb(0.90, 0.90, 0.93) });
    const text = columns[c].name.slice(0, 18);
    ctx.page.drawText(text, { x: x + 3, y: ctx.y - 7, size: 7, font: ctx.fontBold, color: BLACK });
  }
  ctx.y -= 14;

  // Data rows
  for (const row of rows) {
    ensureSpace(ctx, 14);
    for (let c = 0; c < columns.length; c++) {
      const x = startX + c * colW;
      ctx.page.drawLine({ start: { x, y: ctx.y - 10 }, end: { x: x + colW, y: ctx.y - 10 }, thickness: 0.3, color: LGRAY });
      const cellVal = String(row[columns[c].id] ?? "");
      ctx.page.drawText(cellVal.slice(0, 20), { x: x + 3, y: ctx.y - 7, size: 7, font: ctx.fontRegular, color: BLACK });
    }
    ctx.y -= 12;
  }
  ctx.y -= 4;
}

// ── Actions ───────────────────────────────────────────────────────

function drawActions(ctx: PageCtx, actions: InspectionAction[]) {
  if (!actions.length) return;

  ensureSpace(ctx, 30);
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 16, width: CONTENT_W, height: 18, color: rgb(1, 0.95, 0.90) });
  ctx.page.drawText("CORRECTIVE ACTIONS", { x: MARGIN + 8, y: ctx.y - 12, size: 10, font: ctx.fontBold, color: RED });
  ctx.y -= 26;

  for (const action of actions) {
    ensureSpace(ctx, 20);
    const priorityColor = action.priority === "critical" ? RED : action.priority === "high" ? RED : action.priority === "medium" ? YELLOW : GRAY;
    ctx.page.drawText(`• ${action.title}`, { x: MARGIN + 8, y: ctx.y, size: 9, font: ctx.fontRegular, color: BLACK });
    ctx.y -= 12;
    ctx.page.drawText(`Priority: ${action.priority}  |  Status: ${action.status}`, { x: MARGIN + 16, y: ctx.y, size: 8, font: ctx.fontRegular, color: priorityColor });
    ctx.y -= 14;
  }
}

// ── Signatures ────────────────────────────────────────────────────

async function drawSignatures(ctx: PageCtx, signatures: { employeeName: string; role: string; signedAt: string; signatureData: string }[]) {
  if (!signatures.length) return;

  ensureSpace(ctx, 30);
  ctx.page.drawRectangle({ x: MARGIN, y: ctx.y - 16, width: CONTENT_W, height: 18, color: rgb(0.93, 0.96, 0.93) });
  ctx.page.drawText("SIGNATURES", { x: MARGIN + 8, y: ctx.y - 12, size: 10, font: ctx.fontBold, color: GREEN });
  ctx.y -= 28;

  for (const sig of signatures) {
    ensureSpace(ctx, 60);

    // Try to embed signature image
    if (sig.signatureData) {
      try {
        const dataUrl = sig.signatureData;
        const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
        const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        const img = await ctx.doc.embedPng(bytes);
        const scale = Math.min(100 / img.width, 40 / img.height);
        ctx.page.drawImage(img, { x: MARGIN + 8, y: ctx.y - 40, width: img.width * scale, height: img.height * scale });
      } catch {
        // If signature image fails, just show text
      }
    }

    ctx.page.drawText(sig.employeeName, { x: MARGIN + 120, y: ctx.y - 10, size: 9, font: ctx.fontBold, color: BLACK });
    ctx.page.drawText(`${sig.role} — ${formatDate(sig.signedAt)}`, { x: MARGIN + 120, y: ctx.y - 22, size: 8, font: ctx.fontRegular, color: GRAY });
    ctx.y -= 50;
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return d;
  }
}

function formatAnswer(q: TemplateQuestion, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";

  switch (q.type) {
    case "yes_no_na":
      return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    case "checkbox":
      return value === true || value === "checked" ? "☑ Yes" : "☐ No";
    case "rating": {
      const r = Number(value) || 0;
      return "★".repeat(r) + "☆".repeat(5 - r) + ` (${r}/5)`;
    }
    case "date":
      return formatDate(String(value));
    case "multiple_selection":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "photo":
      if (typeof value === "object" && value !== null && "url" in (value as Record<string, unknown>)) {
        return `[Photo: ${(value as { name?: string }).name || "attached"}]`;
      }
      return "[Photo attached]";
    case "signature":
      return "[Signature captured]";
    case "table":
      return ""; // handled by drawTable
    case "long_text":
      return String(value);
    default:
      return String(value);
  }
}

// ── Main handler ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Fetch inspection with conductor name
  const rows = await db
    .select({ inspection: inspections, userName: users.name, userEmail: users.email })
    .from(inspections)
    .leftJoin(users, eq(inspections.conductedBy, users.id))
    .where(eq(inspections.id, id));

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { inspection, userName, userEmail } = rows[0];
  const snapshot = inspection.templateSnapshot as { sections: TemplateSection[]; scoringEnabled: boolean };

  // Fetch responses
  const respRows = await db.select().from(inspectionResponses).where(eq(inspectionResponses.inspectionId, id));

  // Build response map: key = `${questionId}_${repeatIndex}`
  const responseMap = new Map<string, InspectionResponse>();
  const sectionRepeatCounts = new Map<string, number>();
  for (const r of respRows) {
    const key = `${r.questionId}_${r.repeatIndex ?? 0}`;
    responseMap.set(key, r as unknown as InspectionResponse);
    const ri = r.repeatIndex ?? 0;
    const current = sectionRepeatCounts.get(r.sectionId) ?? 0;
    if (ri + 1 > current) sectionRepeatCounts.set(r.sectionId, ri + 1);
  }

  // Fetch actions
  const actions = await db.select().from(inspectionActions).where(eq(inspectionActions.inspectionId, id)) as unknown as InspectionAction[];

  // Fetch signatures
  let sigRows: { employeeName: string; role: string; signedAt: string; signatureData: string }[] = [];
  try {
    sigRows = (await db.select({
      employeeName: inspectionSignatures.employeeName,
      role: inspectionSignatures.role,
      signedAt: inspectionSignatures.signedAt,
      signatureData: inspectionSignatures.signatureData,
    }).from(inspectionSignatures).where(eq(inspectionSignatures.inspectionId, id))) as unknown as typeof sigRows;
  } catch {
    // signatures table may not exist yet
  }

  // ── Build PDF ─────────────────────────────────────────────────
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: PageCtx = {
    doc,
    page: null!,
    y: PAGE_H - MARGIN,
    pageNum: 0,
    totalPages: 0,
    fontRegular,
    fontBold,
    title: inspection.title,
  };

  addPage(ctx);

  // Header
  drawHeader(ctx, {
    title: inspection.title,
    status: inspection.status,
    score: inspection.score ? Number(inspection.score) : null,
    scoringEnabled: snapshot.scoringEnabled,
    site: inspection.site,
    conductedBy: userName || userEmail || null,
    startedAt: (inspection.startedAt as unknown as Date).toISOString(),
    completedAt: inspection.completedAt ? (inspection.completedAt as unknown as Date).toISOString() : null,
    ncrNumber: inspection.ncrNumber,
  });

  // Sections
  const sections = snapshot.sections.sort((a, b) => a.position - b.position);
  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    sec.questions.sort((a, b) => a.position - b.position);
    const repeatCount = sectionRepeatCounts.get(sec.id) ?? 1;
    drawSection(ctx, sec, si, responseMap, repeatCount);
  }

  // Corrective actions
  drawActions(ctx, actions);

  // Signatures
  await drawSignatures(ctx, sigRows);

  // Draw footers on all pages
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const text = `Private & confidential  —  ${i + 1}/${pages.length}`;
    const w = fontRegular.widthOfTextAtSize(text, 8);
    p.drawText(text, { x: PAGE_W - MARGIN - w, y: MARGIN - 15, size: 8, font: fontRegular, color: GRAY });

    // Title in footer left
    const titleText = inspection.title;
    p.drawText(titleText, { x: MARGIN, y: MARGIN - 15, size: 8, font: fontRegular, color: GRAY });
  }

  const pdfBytes = await doc.save();

  // Sanitize filename
  const safeName = inspection.title.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/\s+/g, "_").slice(0, 60);

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safeName}_Report.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
