import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspections, inspectionResponses, inspectionActions, inspectionSignatures, inspectionTemplates, pdfTemplates, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type {
  TemplateSection, TemplateQuestion, InspectionResponse, InspectionAction,
  PdfTemplateConfig, PdfBlock, HeaderBlock, InfoFieldsBlock, TextBlock,
  QuestionsBlock, ActionsBlock, SignaturesBlock, FooterBlock, FontFamily,
  QuestionType, QuestionTypeStyle,
} from "@/lib/types";
import { DEFAULT_PDF_CONFIG, buildDefaultQuestionTypeStyles } from "@/lib/types";
import { scoreLabel } from "@/lib/scoring";

export const dynamic = "force-dynamic";

// ── Helpers ───────────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

// Strip non-WinAnsi characters that crash pdf-lib StandardFonts
function sanitize(text: string): string {
  return text
    .replace(/\u2014/g, "--")   // em dash
    .replace(/\u2013/g, "-")    // en dash
    .replace(/\u2018/g, "'")    // left single quote
    .replace(/\u2019/g, "'")    // right single quote
    .replace(/\u201C/g, '"')    // left double quote
    .replace(/\u201D/g, '"')    // right double quote
    .replace(/\u2022/g, "*")    // bullet
    .replace(/\u2026/g, "...")  // ellipsis
    .replace(/\u2691/g, "!")    // flag ⚑
    .replace(/\u2605/g, "*")    // filled star ★
    .replace(/\u2606/g, "o")    // empty star ☆
    .replace(/\u2611/g, "[x]")  // checked box ☑
    .replace(/\u2610/g, "[ ]")  // unchecked box ☐
    .replace(/[^\x00-\xFF]/g, ""); // drop anything else outside Latin-1
}

const GRAY   = rgb(0.40, 0.40, 0.40);
const LGRAY  = rgb(0.85, 0.85, 0.85);
const BLACK  = rgb(0, 0, 0);
const WHITE  = rgb(1, 1, 1);
const GREEN  = rgb(0.15, 0.55, 0.20);
const RED    = rgb(0.75, 0.15, 0.15);
const YELLOW = rgb(0.70, 0.55, 0.05);
const FOOTER_H = 30;

function getPageDimensions(cfg: PdfTemplateConfig) {
  let w = 612, h = 792;
  if (cfg.pageSize === "a4") { w = 595; h = 842; }
  if (cfg.orientation === "landscape") { const tmp = w; w = h; h = tmp; }
  return { w, h };
}

// ── Font map to support per-block font families ───────────────────
type EmbeddedFont = Awaited<ReturnType<Awaited<ReturnType<typeof PDFDocument.create>>["embedFont"]>>;

interface FontSet {
  regular: EmbeddedFont;
  bold: EmbeddedFont;
}

interface Fonts {
  helvetica: FontSet;
  times: FontSet;
  courier: FontSet;
}

function getFont(fonts: Fonts, family: FontFamily = "helvetica"): FontSet {
  return fonts[family] ?? fonts.helvetica;
}

interface PageCtx {
  doc: Awaited<ReturnType<typeof PDFDocument.create>>;
  page: ReturnType<Awaited<ReturnType<typeof PDFDocument.create>>["addPage"]>;
  y: number;
  pageNum: number;
  fonts: Fonts;
  title: string;
  cfg: PdfTemplateConfig;
  pageW: number;
  pageH: number;
  margin: number;
  contentW: number;
}

function addPage(ctx: PageCtx): void {
  ctx.page = ctx.doc.addPage([ctx.pageW, ctx.pageH]);
  ctx.pageNum++;
  ctx.y = ctx.pageH - ctx.cfg.margins.top;
}

function ensureSpace(ctx: PageCtx, needed: number): void {
  if (ctx.y - needed < ctx.cfg.margins.bottom + FOOTER_H) {
    addPage(ctx);
  }
}

// ── Generic text draw with word-wrap ──────────────────────────────

function drawWrappedText(ctx: PageCtx, rawText: string, x: number, size: number, options?: { color?: ReturnType<typeof rgb>; font?: EmbeddedFont; maxWidth?: number; align?: "left" | "center" | "right" }) {
  const text = sanitize(rawText);
  const font = options?.font ?? ctx.fonts.helvetica.regular;
  const color = options?.color ?? BLACK;
  const maxWidth = options?.maxWidth ?? ctx.contentW;

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

  const align = options?.align ?? "left";
  for (const l of lines) {
    ensureSpace(ctx, size + 4);
    let dx = x;
    if (align === "center") dx = x + (maxWidth - font.widthOfTextAtSize(l, size)) / 2;
    else if (align === "right") dx = x + maxWidth - font.widthOfTextAtSize(l, size);
    ctx.page.drawText(l, { x: dx, y: ctx.y, size, font, color });
    ctx.y -= size + 4;
  }
}

// ═══════════════════════════════════════════════════════════════════
// Block Renderers
// ═══════════════════════════════════════════════════════════════════

async function embedLogoImage(ctx: PageCtx, url: string, maxHeight: number, position: "left" | "center" | "right") {
  if (!url) return;
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const contentType = res.headers.get("content-type") || "";
    let img;
    if (contentType.includes("png") || url.toLowerCase().endsWith(".png")) {
      img = await ctx.doc.embedPng(bytes);
    } else {
      img = await ctx.doc.embedJpg(bytes);
    }
    const scale = Math.min(maxHeight / img.height, ctx.contentW * 0.5 / img.width, 1);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    ensureSpace(ctx, drawH + 4);
    let x = ctx.margin;
    if (position === "center") x = ctx.margin + (ctx.contentW - drawW) / 2;
    else if (position === "right") x = ctx.margin + ctx.contentW - drawW;
    ctx.page.drawImage(img, { x, y: ctx.y - drawH, width: drawW, height: drawH });
    ctx.y -= drawH + 4;
  } catch {
    // skip broken logo
  }
}

async function renderHeaderBlock(ctx: PageCtx, block: HeaderBlock, data: InspectionData) {
  const fset = getFont(ctx.fonts, block.fontFamily);

  // Logo
  if (block.logoUrl) {
    await embedLogoImage(ctx, block.logoUrl, block.logoMaxHeight ?? 40, block.logoPosition ?? "left");
  }

  // Company name
  if (block.companyName) {
    ensureSpace(ctx, block.companyNameSize + 6);
    ctx.page.drawText(block.companyName, { x: ctx.margin, y: ctx.y, size: block.companyNameSize, font: fset.bold, color: hexToRgb(block.companyNameColor) });
    ctx.y -= block.companyNameSize + 6;
  }

  // Title bar
  const titleText = block.titleSource === "custom" && block.customTitle ? block.customTitle : data.title;
  ensureSpace(ctx, block.fontSize + 16);
  const barH = block.fontSize + 14;
  ctx.page.drawRectangle({ x: ctx.margin, y: ctx.y - barH, width: ctx.contentW, height: barH, color: hexToRgb(block.bgColor) });

  let titleX = ctx.margin + 10;
  if (block.alignment === "center") titleX = ctx.margin + (ctx.contentW - fset.bold.widthOfTextAtSize(titleText, block.fontSize)) / 2;
  else if (block.alignment === "right") titleX = ctx.pageW - ctx.margin - fset.bold.widthOfTextAtSize(titleText, block.fontSize) - 10;

  ctx.page.drawText(titleText, { x: titleX, y: ctx.y - barH + (barH - block.fontSize) / 2 + 2, size: block.fontSize, font: fset.bold, color: hexToRgb(block.textColor) });

  // Status badge
  if (block.showStatusBadge) {
    const statusText = data.status.replace("_", " ").toUpperCase();
    const statusW = fset.bold.widthOfTextAtSize(statusText, 8) + 12;
    const badgeColor = data.status === "completed" ? GREEN : data.status === "pending_review" ? YELLOW : GRAY;
    ctx.page.drawRectangle({ x: ctx.pageW - ctx.margin - statusW - 6, y: ctx.y - barH + 4, width: statusW, height: 16, color: badgeColor });
    ctx.page.drawText(statusText, { x: ctx.pageW - ctx.margin - statusW, y: ctx.y - barH + 8, size: 8, font: fset.bold, color: WHITE });
  }

  ctx.y -= barH + 8;
}

function renderInfoFieldsBlock(ctx: PageCtx, block: InfoFieldsBlock, data: InspectionData) {
  const fset = getFont(ctx.fonts, block.fontFamily);
  const labelClr = hexToRgb(block.labelColor);
  const valueClr = hexToRgb(block.valueColor);
  const fs = block.fontSize;

  const fieldValues: Record<string, string> = {
    site: data.site ?? "",
    conductor: data.conductedBy ?? "",
    started: formatDate(data.startedAt),
    completed: data.completedAt ? formatDate(data.completedAt) : "",
    ncr: data.ncrNumber ?? "",
    score: data.score !== null && data.scoringEnabled ? `${data.score}% -- ${scoreLabel(data.score)}` : "",
  };

  const active = block.fields.filter((f) => f.enabled && fieldValues[f.key]);

  if (block.layout === "two_column") {
    for (let i = 0; i < active.length; i += 2) {
      ensureSpace(ctx, fs + 6);
      const halfW = ctx.contentW / 2;
      // Left column
      const f1 = active[i];
      const label1 = `${f1.label}: `;
      const lw1 = fset.bold.widthOfTextAtSize(label1, fs);
      ctx.page.drawText(label1, { x: ctx.margin, y: ctx.y, size: fs, font: fset.bold, color: labelClr });
      ctx.page.drawText(sanitize(fieldValues[f1.key]), { x: ctx.margin + lw1, y: ctx.y, size: fs, font: fset.regular, color: valueClr });

      // Right column
      if (i + 1 < active.length) {
        const f2 = active[i + 1];
        const label2 = `${f2.label}: `;
        const lw2 = fset.bold.widthOfTextAtSize(label2, fs);
        ctx.page.drawText(label2, { x: ctx.margin + halfW, y: ctx.y, size: fs, font: fset.bold, color: labelClr });
        ctx.page.drawText(sanitize(fieldValues[f2.key]), { x: ctx.margin + halfW + lw2, y: ctx.y, size: fs, font: fset.regular, color: valueClr });
      }
      ctx.y -= fs + 6;
    }
  } else {
    for (const f of active) {
      ensureSpace(ctx, fs + 6);
      const label = `${f.label}: `;
      const lw = fset.bold.widthOfTextAtSize(label, fs);
      ctx.page.drawText(label, { x: ctx.margin, y: ctx.y, size: fs, font: fset.bold, color: labelClr });
      ctx.page.drawText(fieldValues[f.key], { x: ctx.margin + lw, y: ctx.y, size: fs, font: fset.regular, color: valueClr });
      ctx.y -= fs + 6;
    }
  }
  ctx.y -= 4;
}

function renderTextBlock(ctx: PageCtx, block: TextBlock) {
  if (!block.content) return;
  const fset = getFont(ctx.fonts, block.fontFamily);
  const font = block.bold ? fset.bold : fset.regular;
  const clr = hexToRgb(block.color);

  // Background
  if (block.bgColor && block.bgColor !== "#FFFFFF" && block.bgColor !== "#ffffff") {
    const estimatedH = Math.ceil(font.widthOfTextAtSize(block.content, block.fontSize) / ctx.contentW) * (block.fontSize + 4) + 8;
    ensureSpace(ctx, estimatedH);
    ctx.page.drawRectangle({ x: ctx.margin, y: ctx.y - estimatedH, width: ctx.contentW, height: estimatedH, color: hexToRgb(block.bgColor) });
  }

  drawWrappedText(ctx, block.content, ctx.margin, block.fontSize, { color: clr, font, maxWidth: ctx.contentW, align: block.alignment });
  ctx.y -= 4;
}

async function renderQuestionsBlock(
  ctx: PageCtx,
  block: QuestionsBlock,
  sections: TemplateSection[],
  responseMap: Map<string, InspectionResponse>,
  sectionRepeatCounts: Map<string, number>
) {
  const fset = getFont(ctx.fonts, block.fontFamily);
  const L = ctx.margin;                   // table left edge
  const R = ctx.pageW - ctx.margin;       // table right edge
  const W = R - L;                        // table width
  const pad = 10;                         // cell padding
  const lineClr = hexToRgb(block.dividerColor ?? "#CCCCCC");
  const lineThk = block.dividerThickness ?? 1;

  // Draw a horizontal line across the full table width
  function line(y: number) {
    ctx.page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: lineThk, color: lineClr });
  }

  for (let si = 0; si < sections.length; si++) {
    const sec = sections[si];
    sec.questions.sort((a, b) => a.position - b.position);
    const reps = sectionRepeatCounts.get(sec.id) ?? 1;
    const sNum = block.showSectionNumbers ? `${si + 1}` : "";

    for (let ri = 0; ri < reps; ri++) {
      // Section header
      if (block.showSectionHeaders) {
        if (si > 0 || ri > 0) ctx.y -= 10;
        const h = block.sectionFontSize + 8;
        ensureSpace(ctx, h);
        let t = sNum ? `${sNum}. ${sec.title}` : sec.title;
        if (reps > 1) t += ` (Instance ${ri + 1})`;
        ctx.page.drawRectangle({ x: L, y: ctx.y - h, width: W, height: h, color: hexToRgb(block.sectionHeaderBg) });
        ctx.page.drawText(sanitize(t.toUpperCase()), { x: L + pad, y: ctx.y - h + (h - block.sectionFontSize) / 2, size: block.sectionFontSize, font: fset.bold, color: hexToRgb(block.sectionHeaderColor) });
        ctx.y -= h;
        line(ctx.y); // line below section header
      }

      for (let qi = 0; qi < sec.questions.length; qi++) {
        const q = sec.questions[qi];
        const resp = responseMap.get(`${q.id}_${ri}`);
        if (!block.showEmptyQuestions && !resp?.value && resp?.value !== 0 && resp?.value !== false) continue;

        const ts = (block.questionTypeStyles ?? {})[q.type as QuestionType];
        const qSz = ts?.questionFontSize || block.questionFontSize;
        const aSz = ts?.answerFontSize || block.answerFontSize;
        const qClr = hexToRgb(ts?.questionColor || block.questionColor);
        const aClr = resp?.flagged ? hexToRgb(block.flagColor) : hexToRgb(ts?.answerColor || block.answerColor);
        const aBg = ts?.bgColor;
        const num = block.showQuestionNumbers ? (sNum ? `${sNum}.${qi + 1}` : `${qi + 1}`) : "";
        const label = sanitize(num ? `${num}. ${q.title}` : q.title);
        const answer = sanitize(formatAnswer(q, resp?.value));

        // ── Signature (needs image embed) ──
        if (q.type === "signature") {
          const rowH = qSz + pad * 2;
          ensureSpace(ctx, rowH + 45);
          ctx.page.drawText(label, { x: L + pad, y: ctx.y - pad - qSz * 0.72, size: qSz, font: fset.bold, color: qClr });
          ctx.y -= rowH;
          line(ctx.y);
          const val = resp?.value;
          if (val) {
            try {
              // Value can be: a JSON string, a parsed object, or a raw data URL
              let sigData: string | undefined;
              let signedAt: string | undefined;

              if (typeof val === "object" && val !== null) {
                // Already parsed object: {signature: "data:...", signedAt: "..."}
                const obj = val as Record<string, unknown>;
                sigData = (obj.signature as string) || undefined;
                signedAt = (obj.signedAt as string) || undefined;
              } else if (typeof val === "string") {
                const s = val as string;
                if (s.startsWith("{")) {
                  const parsed = JSON.parse(s);
                  sigData = parsed.signature || undefined;
                  signedAt = parsed.signedAt || undefined;
                } else if (s.startsWith("data:")) {
                  sigData = s;
                }
              }

              if (sigData && sigData.startsWith("data:")) {
                const b64 = sigData.includes(",") ? sigData.split(",")[1] : sigData;
                const bytes = Buffer.from(b64, "base64");
                const img = await ctx.doc.embedPng(bytes);
                const sc = Math.min(120 / img.width, 40 / img.height);
                ctx.page.drawImage(img, { x: L + pad, y: ctx.y - img.height * sc - 2, width: img.width * sc, height: img.height * sc });
                ctx.y -= img.height * sc + 4;
                if (signedAt) {
                  ctx.page.drawText(sanitize(`Signed: ${formatDate(signedAt)}`), { x: L + pad, y: ctx.y, size: 7, font: fset.regular, color: GRAY });
                  ctx.y -= 10;
                }
              }
            } catch { /* skip broken signature */ }
          }
          line(ctx.y);
          continue;
        }

        // ── Long text: label row + wrapped text row ──
        if (q.type === "long_text") {
          const rowH = qSz + pad * 2;
          ensureSpace(ctx, rowH + aSz + pad * 2);
          ctx.page.drawText(label, { x: L + pad, y: ctx.y - pad - qSz * 0.72, size: qSz, font: fset.bold, color: qClr });
          ctx.y -= rowH;
          line(ctx.y);
          drawWrappedText(ctx, answer, L + pad, aSz, { color: aClr, font: fset.regular, maxWidth: W - pad * 2 });
          ctx.y -= 2;
          line(ctx.y);
          continue;
        }

        // ── Photo (needs image embed) ──
        if (q.type === "photo") {
          const rowH = qSz + pad * 2;
          ensureSpace(ctx, rowH + 60);
          ctx.page.drawText(label, { x: L + pad, y: ctx.y - pad - qSz * 0.72, size: qSz, font: fset.bold, color: qClr });
          ctx.y -= rowH;
          line(ctx.y);
          const val = resp?.value;
          if (val && typeof val === "string" && (val as string).startsWith("data:")) {
            try {
              const b64 = (val as string).includes(",") ? (val as string).split(",")[1] : (val as string);
              const bytes = Buffer.from(b64, "base64");
              const ct = (val as string).split(";")[0].split(":")[1] || "";
              const img = ct.includes("png")
                ? await ctx.doc.embedPng(bytes)
                : await ctx.doc.embedJpg(bytes);
              const maxW = W * 0.6;
              const maxH = 150;
              const sc = Math.min(maxW / img.width, maxH / img.height, 1);
              const drawW = img.width * sc;
              const drawH = img.height * sc;
              ensureSpace(ctx, drawH + 6);
              ctx.page.drawImage(img, { x: L + pad, y: ctx.y - drawH - 2, width: drawW, height: drawH });
              ctx.y -= drawH + 6;
            } catch { /* skip broken photo */ }
          } else {
            ctx.page.drawText("[No photo attached]", { x: L + pad, y: ctx.y - 10, size: 7, font: fset.regular, color: GRAY });
            ctx.y -= 14;
          }
          line(ctx.y);
          continue;
        }

        // ── Table type ──
        if (q.type === "table") {
          const rowH = qSz + pad * 2;
          ensureSpace(ctx, rowH + 20);
          ctx.page.drawText(label, { x: L + pad, y: ctx.y - pad - qSz * 0.72, size: qSz, font: fset.bold, color: qClr });
          ctx.y -= rowH;
          line(ctx.y);
          // Table value is stored as JSON string of row array
          let tableRows: Record<string, unknown>[] = [];
          if (resp?.value) {
            if (typeof resp.value === "string") {
              try { tableRows = JSON.parse(resp.value as string); } catch { /* skip */ }
            } else if (Array.isArray(resp.value)) {
              tableRows = resp.value as Record<string, unknown>[];
            }
          }
          if (Array.isArray(tableRows) && tableRows.length > 0) {
            drawTable(ctx, q, tableRows);
          }
          line(ctx.y);
          continue;
        }

        // ── Normal row: question left, answer right, single line ──
        const rowH = Math.max(qSz, aSz) + pad * 2;
        ensureSpace(ctx, rowH);
        const baseline = ctx.y - pad - Math.max(qSz, aSz) * 0.72;

        // Question on left
        ctx.page.drawText(label, { x: L + pad, y: baseline, size: qSz, font: fset.bold, color: qClr });

        // Answer on right
        if (aBg && aBg !== "#ffffff" && aBg !== "#FFFFFF" && aBg !== "") {
          const aw = fset.regular.widthOfTextAtSize(answer, aSz);
          const bw = aw + 12; const bh = aSz + 4;
          ctx.page.drawRectangle({ x: R - pad - bw, y: baseline - 2, width: bw, height: bh, color: hexToRgb(aBg) });
          ctx.page.drawText(answer, { x: R - pad - bw + 6, y: baseline, size: aSz, font: fset.regular, color: WHITE });
        } else {
          const aw = fset.regular.widthOfTextAtSize(answer, aSz);
          ctx.page.drawText(answer, { x: R - pad - aw, y: baseline, size: aSz, font: fset.regular, color: aClr });
        }

        ctx.y -= rowH;
        line(ctx.y);

        // Flag / notes below the row line
        if (block.showFlags && resp?.flagged) {
          ensureSpace(ctx, 14);
          ctx.page.drawText("! FLAGGED", { x: L + pad, y: ctx.y - 10, size: 7, font: fset.bold, color: hexToRgb(block.flagColor) });
          ctx.y -= 16;
        }
        if (block.showNotes && resp?.note) {
          ensureSpace(ctx, 14);
          ctx.page.drawText(sanitize(`Note: ${resp.note}`), { x: L + pad + 4, y: ctx.y - 4, size: Math.max(aSz - 1, 7), font: fset.regular, color: hexToRgb(block.noteColor) });
          ctx.y -= 15;
        }
      }
    }
  }
}

function drawTable(ctx: PageCtx, q: TemplateQuestion, rows: Record<string, unknown>[]) {
  // Table columns are stored in q.options: [{id, text: columnName, score: 0=text|1=number|2=date}, ...]
  const opts = (q.options ?? []) as { id: string; text: string; score?: number }[];
  const columns = opts.map((o) => ({ id: o.id, name: o.text || "Column" }));
  if (!columns.length) return;

  const tableW = ctx.contentW - 16;
  const colW = Math.min(150, tableW / columns.length);
  const startX = ctx.margin + 8;
  const fset = ctx.fonts.helvetica;
  const fontSize = 7;
  const headerH = 16;
  const rowH = 14;

  // Header row
  ensureSpace(ctx, headerH);
  for (let c = 0; c < columns.length; c++) {
    const x = startX + c * colW;
    ctx.page.drawRectangle({ x, y: ctx.y - headerH, width: colW, height: headerH, color: rgb(0.90, 0.90, 0.93) });
    const text = sanitize(columns[c].name).slice(0, 25);
    ctx.page.drawText(text, { x: x + 4, y: ctx.y - headerH + 4, size: fontSize, font: fset.bold, color: BLACK });
    // Column border
    if (c > 0) {
      ctx.page.drawLine({ start: { x, y: ctx.y }, end: { x, y: ctx.y - headerH }, thickness: 0.3, color: LGRAY });
    }
  }
  // Bottom line of header
  ctx.page.drawLine({ start: { x: startX, y: ctx.y - headerH }, end: { x: startX + columns.length * colW, y: ctx.y - headerH }, thickness: 0.5, color: GRAY });
  ctx.y -= headerH;

  // Data rows
  for (const row of rows) {
    ensureSpace(ctx, rowH);
    for (let c = 0; c < columns.length; c++) {
      const x = startX + c * colW;
      // Alternate row shading
      const cellVal = sanitize(String(row[columns[c].id] ?? "")).slice(0, 30);
      ctx.page.drawText(cellVal, { x: x + 4, y: ctx.y - rowH + 3, size: fontSize, font: fset.regular, color: BLACK });
      // Column border
      if (c > 0) {
        ctx.page.drawLine({ start: { x, y: ctx.y }, end: { x, y: ctx.y - rowH }, thickness: 0.3, color: LGRAY });
      }
    }
    // Bottom line of row
    ctx.page.drawLine({ start: { x: startX, y: ctx.y - rowH }, end: { x: startX + columns.length * colW, y: ctx.y - rowH }, thickness: 0.3, color: LGRAY });
    ctx.y -= rowH;
  }
  ctx.y -= 4;
}

function renderActionsBlock(ctx: PageCtx, block: ActionsBlock, actions: InspectionAction[]) {
  if (!actions.length) return;
  const fset = getFont(ctx.fonts, block.fontFamily);

  ensureSpace(ctx, 30);
  ctx.page.drawRectangle({ x: ctx.margin, y: ctx.y - 16, width: ctx.contentW, height: 18, color: hexToRgb(block.headerBg) });
  ctx.page.drawText(block.headerText, { x: ctx.margin + 8, y: ctx.y - 12, size: block.fontSize + 1, font: fset.bold, color: hexToRgb(block.headerColor) });
  ctx.y -= 26;

  for (const action of actions) {
    ensureSpace(ctx, 20);
    const priorityColor = action.priority === "critical" || action.priority === "high" ? RED : action.priority === "medium" ? YELLOW : GRAY;
    ctx.page.drawText(sanitize(`* ${action.title}`), { x: ctx.margin + 8, y: ctx.y, size: block.fontSize, font: fset.regular, color: BLACK });
    ctx.y -= 14;
    ctx.page.drawText(sanitize(`Priority: ${action.priority}  |  Status: ${action.status}`), { x: ctx.margin + 16, y: ctx.y, size: block.fontSize - 1, font: fset.regular, color: priorityColor });
    ctx.y -= 18;
  }
}

async function renderSignaturesBlock(ctx: PageCtx, block: SignaturesBlock, sigRows: SigRow[]) {
  if (!sigRows.length) return;
  const fset = ctx.fonts.helvetica;

  ensureSpace(ctx, 30);
  ctx.page.drawRectangle({ x: ctx.margin, y: ctx.y - 16, width: ctx.contentW, height: 18, color: hexToRgb(block.headerBg) });
  ctx.page.drawText(block.headerText, { x: ctx.margin + 8, y: ctx.y - 12, size: block.fontSize + 1, font: fset.bold, color: hexToRgb(block.headerColor) });
  ctx.y -= 28;

  for (const sig of sigRows) {
    ensureSpace(ctx, 60);

    if (sig.signatureData) {
      try {
        const dataUrl = sig.signatureData;
        const base64 = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;
        const bytes = Buffer.from(base64, "base64");
        const img = await ctx.doc.embedPng(bytes);
        const scale = Math.min(100 / img.width, 40 / img.height);
        ctx.page.drawImage(img, { x: ctx.margin + 8, y: ctx.y - 40, width: img.width * scale, height: img.height * scale });
      } catch {
        // skip broken images
      }
    }

    ctx.page.drawText(sanitize(sig.employeeName), { x: ctx.margin + 120, y: ctx.y - 10, size: block.fontSize, font: fset.bold, color: BLACK });
    ctx.page.drawText(sanitize(`${sig.role} -- ${formatDate(sig.signedAt)}`), { x: ctx.margin + 120, y: ctx.y - 22, size: block.fontSize - 1, font: fset.regular, color: GRAY });
    ctx.y -= 50;
  }
}

// ── Shared helpers ────────────────────────────────────────────────

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return d;
  }
}

function formatAnswer(q: TemplateQuestion, value: unknown): string {
  if (value === undefined || value === null || value === "") return "N/A";

  switch (q.type) {
    case "yes_no_na":
      return String(value).charAt(0).toUpperCase() + String(value).slice(1);
    case "checkbox":
      return value === true || value === "checked" ? "[x] Yes" : "[ ] No";
    case "rating": {
      const r = Number(value) || 0;
      return `${'*'.repeat(r)}${'o'.repeat(5 - r)} (${r}/5)`;
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
      return "";
    case "long_text":
      return String(value);
    default:
      return String(value);
  }
}

// ── Types ─────────────────────────────────────────────────────────

type SigRow = { employeeName: string; role: string; signedAt: string; signatureData: string };

interface InspectionData {
  title: string;
  status: string;
  score: number | null;
  scoringEnabled: boolean;
  site: string | null;
  conductedBy: string | null;
  startedAt: string;
  completedAt: string | null;
  ncrNumber: string | null;
}

// ── Main handler ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Optional query param to override which PDF template to use
  const overrideTemplateId = _req.nextUrl.searchParams.get("templateId");

  // Fetch inspection with conductor name
  const rows = await db
    .select({ inspection: inspections, userName: users.name, userEmail: users.email })
    .from(inspections)
    .leftJoin(users, eq(inspections.conductedBy, users.id))
    .where(eq(inspections.id, id));

  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { inspection, userName, userEmail } = rows[0];
  const snapshot = inspection.templateSnapshot as { sections: TemplateSection[]; scoringEnabled: boolean };

  // ── Resolve PDF template config ────────────────────────────────
  // Priority: query param templateId → inspection template's pdfTemplateId → default
  let pdfConfig: PdfTemplateConfig = DEFAULT_PDF_CONFIG;
  try {
    let resolvedPdfTemplateId: string | null = null;

    // 1. Check query param override
    if (overrideTemplateId) {
      resolvedPdfTemplateId = overrideTemplateId;
    } else {
      // 2. Fall back to inspection template's linked pdfTemplateId
      const [tmpl] = await db
        .select({ pdfTemplateId: inspectionTemplates.pdfTemplateId })
        .from(inspectionTemplates)
        .where(eq(inspectionTemplates.id, inspection.templateId));
      if (tmpl?.pdfTemplateId) resolvedPdfTemplateId = tmpl.pdfTemplateId;
    }

    if (resolvedPdfTemplateId) {
      const [pdfTmpl] = await db
        .select()
        .from(pdfTemplates)
        .where(eq(pdfTemplates.id, resolvedPdfTemplateId));
      if (pdfTmpl?.config) {
        pdfConfig = { ...DEFAULT_PDF_CONFIG, ...(pdfTmpl.config as PdfTemplateConfig) };
      }
    }
  } catch {
    // Fall back to default
  }

  // Ensure blocks array exists
  if (!pdfConfig.blocks || !pdfConfig.blocks.length) {
    pdfConfig.blocks = DEFAULT_PDF_CONFIG.blocks;
  }

  // Fetch responses
  const respRows = await db.select().from(inspectionResponses).where(eq(inspectionResponses.inspectionId, id));

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
  let sigRows: SigRow[] = [];
  try {
    sigRows = (await db.select({
      employeeName: inspectionSignatures.employeeName,
      role: inspectionSignatures.role,
      signedAt: inspectionSignatures.signedAt,
      signatureData: inspectionSignatures.signatureData,
    }).from(inspectionSignatures).where(eq(inspectionSignatures.inspectionId, id))) as unknown as SigRow[];
  } catch {
    // signatures table may not exist yet
  }

  // ── Build PDF ─────────────────────────────────────────────────
  const { w: pageW, h: pageH } = getPageDimensions(pdfConfig);
  const margin = pdfConfig.margins.left;
  const contentW = pageW - pdfConfig.margins.left - pdfConfig.margins.right;

  const doc = await PDFDocument.create();

  // Embed all font families
  const fonts: Fonts = {
    helvetica: {
      regular: await doc.embedFont(StandardFonts.Helvetica),
      bold: await doc.embedFont(StandardFonts.HelveticaBold),
    },
    times: {
      regular: await doc.embedFont(StandardFonts.TimesRoman),
      bold: await doc.embedFont(StandardFonts.TimesRomanBold),
    },
    courier: {
      regular: await doc.embedFont(StandardFonts.Courier),
      bold: await doc.embedFont(StandardFonts.CourierBold),
    },
  };

  const ctx: PageCtx = {
    doc,
    page: null!,
    y: pageH - pdfConfig.margins.top,
    pageNum: 0,
    fonts,
    title: inspection.title,
    cfg: pdfConfig,
    pageW,
    pageH,
    margin,
    contentW,
  };

  addPage(ctx);

  // Build inspection data object
  const inspData: InspectionData = {
    title: inspection.title,
    status: inspection.status,
    score: inspection.score ? Number(inspection.score) : null,
    scoringEnabled: snapshot.scoringEnabled,
    site: inspection.site,
    conductedBy: userName || userEmail || null,
    startedAt: (inspection.startedAt as unknown as Date).toISOString(),
    completedAt: inspection.completedAt ? (inspection.completedAt as unknown as Date).toISOString() : null,
    ncrNumber: inspection.ncrNumber,
  };

  const sections = snapshot.sections.sort((a, b) => a.position - b.position);

  // ── Render blocks (except footer which is applied separately) ──
  const footerBlocks: FooterBlock[] = [];

  for (const block of pdfConfig.blocks) {
    switch (block.type) {
      case "header":
        await renderHeaderBlock(ctx, block, inspData);
        break;
      case "info_fields":
        renderInfoFieldsBlock(ctx, block, inspData);
        break;
      case "text":
        renderTextBlock(ctx, block);
        break;
      case "questions":
        await renderQuestionsBlock(ctx, block, sections, responseMap, sectionRepeatCounts);
        break;
      case "actions":
        renderActionsBlock(ctx, block, actions);
        break;
      case "signatures":
        await renderSignaturesBlock(ctx, block, sigRows);
        break;
      case "spacer":
        ctx.y -= block.height;
        break;
      case "divider":
        ensureSpace(ctx, 6);
        ctx.page.drawLine({ start: { x: ctx.margin, y: ctx.y }, end: { x: ctx.pageW - ctx.margin, y: ctx.y }, thickness: block.thickness, color: hexToRgb(block.color) });
        ctx.y -= 6;
        break;
      case "page_break":
        addPage(ctx);
        break;
      case "footer":
        footerBlocks.push(block);
        break;
    }
  }

  // ── Draw footers on all pages ─────────────────────────────────
  const pages = doc.getPages();
  const footerCfg = footerBlocks[0]; // use first footer block
  if (footerCfg) {
    const fFont = fonts.helvetica;
    const fColor = hexToRgb(footerCfg.color);
    const fSize = footerCfg.fontSize;

    // Embed footer logo once (if any)
    let footerLogoImg: Awaited<ReturnType<typeof doc.embedPng>> | null = null;
    if (footerCfg.logoUrl) {
      try {
        const logoRes = await fetch(footerCfg.logoUrl);
        if (logoRes.ok) {
          const buf = await logoRes.arrayBuffer();
          const bytes = new Uint8Array(buf);
          const ct = logoRes.headers.get("content-type") || "";
          footerLogoImg = (ct.includes("png") || footerCfg.logoUrl.toLowerCase().endsWith(".png"))
            ? await doc.embedPng(bytes)
            : await doc.embedJpg(bytes);
        }
      } catch { /* skip */ }
    }

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      let footerY = pdfConfig.margins.bottom - 15;

      // Footer logo
      if (footerLogoImg) {
        const maxH = footerCfg.logoMaxHeight ?? 20;
        const scale = Math.min(maxH / footerLogoImg.height, contentW * 0.3 / footerLogoImg.width, 1);
        const lw = footerLogoImg.width * scale;
        const lh = footerLogoImg.height * scale;
        let lx = margin;
        if (footerCfg.logoPosition === "center") lx = margin + (contentW - lw) / 2;
        else if (footerCfg.logoPosition === "right") lx = margin + contentW - lw;
        p.drawImage(footerLogoImg, { x: lx, y: footerY - lh + fSize, width: lw, height: lh });
        // Shift text down if logo is tall
        if (lh > fSize + 4) footerY -= lh - fSize;
      }

      // Left side
      const leftParts: string[] = [];
      if (footerCfg.showTitle) leftParts.push(inspection.title);
      if (footerCfg.leftText) leftParts.push(footerCfg.leftText);
      const leftStr = leftParts.join("  --  ");
      if (leftStr) {
        p.drawText(leftStr, { x: margin, y: footerY, size: fSize, font: fFont.regular, color: fColor });
      }

      // Right side
      const rightParts: string[] = [];
      if (footerCfg.rightText) rightParts.push(footerCfg.rightText);
      if (footerCfg.showPageNumbers) rightParts.push(`${i + 1}/${pages.length}`);
      const rightStr = rightParts.join("  --  ");
      if (rightStr) {
        const w = fFont.regular.widthOfTextAtSize(rightStr, fSize);
        p.drawText(rightStr, { x: pageW - margin - w, y: footerY, size: fSize, font: fFont.regular, color: fColor });
      }
    }
  }

  const pdfBytes = await doc.save();
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
