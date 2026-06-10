/**
 * Commercial-document PDF rendering (audit P5 — invoices/estimates had no
 * PDF at all). One renderer for any line-item document: header band, parties,
 * meta grid, lines table with wrapping, totals block, notes/footer. Money in
 * minor units, formatted with the document currency.
 */
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";

const BLUE = rgb(0 / 255, 115 / 255, 234 / 255); // Vibe primary
const GRAY = rgb(0.45, 0.47, 0.5);
const DARK = rgb(0.1, 0.12, 0.15);
const LINE = rgb(0.88, 0.9, 0.92);

function sanitize(text: string): string {
  return text
    .replace(/—/g, "--").replace(/–/g, "-")
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/•/g, "*").replace(/…/g, "...")
    .replace(/[^\x00-\xFF]/g, "?");
}

export interface DocPdfLine {
  description: string;
  quantity: number;
  unitMinor: number;
  taxMinor?: number;
  amountMinor: number;
}

export interface DocPdfInput {
  docType: string; // "INVOICE" | "ESTIMATE" | "PURCHASE ORDER" …
  docNumber: string;
  status?: string;
  companyName: string; // issuing workspace
  partyLabel: string; // "Bill to" | "Vendor"
  partyName: string;
  currency: string;
  issueDate?: Date | null;
  dueDate?: Date | null;
  lines: DocPdfLine[];
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  paidMinor?: number;
  notes?: string | null;
}

function money(minor: number, currency: string): string {
  return `${currency} ${(minor / 100).toFixed(2)}`;
}

function fmtDate(d?: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "--";
}

export async function renderDocumentPdf(input: DocPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 48;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const text = (p: PDFPage, s: string, x: number, yy: number, size: number, f: PDFFont, color = DARK) =>
    p.drawText(sanitize(s), { x, y: yy, size, font: f, color });

  // ── Header band ─────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: pageHeight - 90, width: pageWidth, height: 90, color: BLUE });
  text(page, input.companyName, margin, pageHeight - 46, 16, bold, rgb(1, 1, 1));
  text(page, input.docType, pageWidth - margin - bold.widthOfTextAtSize(input.docType, 20), pageHeight - 44, 20, bold, rgb(1, 1, 1));
  text(page, input.docNumber, pageWidth - margin - font.widthOfTextAtSize(input.docNumber, 11), pageHeight - 62, 11, font, rgb(1, 1, 1));
  y = pageHeight - 120;

  // ── Parties + meta ──────────────────────────────────────────────
  text(page, input.partyLabel.toUpperCase(), margin, y, 8, bold, GRAY);
  text(page, input.partyName, margin, y - 14, 12, bold);
  const metaX = pageWidth - margin - 170;
  const meta: [string, string][] = [
    ["Issue date", fmtDate(input.issueDate)],
    ["Due date", fmtDate(input.dueDate)],
    ...(input.status ? ([["Status", input.status]] as [string, string][]) : []),
  ];
  let metaY = y;
  for (const [k, v] of meta) {
    text(page, k, metaX, metaY, 9, font, GRAY);
    text(page, v, metaX + 80, metaY, 9, bold);
    metaY -= 14;
  }
  y -= 50;

  // ── Lines table ─────────────────────────────────────────────────
  const cols = { desc: margin, qty: 330, unit: 390, amount: pageWidth - margin };
  const headerRow = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: margin - 6, y: yy - 4, width: pageWidth - margin * 2 + 12, height: 18, color: rgb(0.96, 0.97, 0.98) });
    text(p, "DESCRIPTION", cols.desc, yy, 8, bold, GRAY);
    text(p, "QTY", cols.qty, yy, 8, bold, GRAY);
    text(p, "UNIT", cols.unit, yy, 8, bold, GRAY);
    const h = "AMOUNT";
    text(p, h, cols.amount - bold.widthOfTextAtSize(h, 8), yy, 8, bold, GRAY);
  };
  headerRow(page, y);
  y -= 22;

  const wrap = (s: string, width: number, size: number): string[] => {
    const words = sanitize(s).split(/\s+/);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const cand = cur ? `${cur} ${w}` : w;
      if (font.widthOfTextAtSize(cand, size) > width && cur) { lines.push(cur); cur = w; }
      else cur = cand;
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 4);
  };

  for (const line of input.lines) {
    const descLines = wrap(line.description || "--", cols.qty - cols.desc - 12, 9.5);
    const rowHeight = Math.max(16, descLines.length * 12 + 4);
    if (y - rowHeight < 150) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      headerRow(page, y);
      y -= 22;
    }
    descLines.forEach((dl, i) => text(page, dl, cols.desc, y - i * 12, 9.5, font));
    text(page, String(line.quantity), cols.qty, y, 9.5, font);
    text(page, money(line.unitMinor, input.currency), cols.unit, y, 9.5, font);
    const amt = money(line.amountMinor, input.currency);
    text(page, amt, cols.amount - font.widthOfTextAtSize(amt, 9.5), y, 9.5, font);
    y -= rowHeight;
    page.drawLine({ start: { x: margin - 6, y: y + 6 }, end: { x: pageWidth - margin + 6, y: y + 6 }, thickness: 0.5, color: LINE });
    y -= 6;
  }

  // ── Totals ──────────────────────────────────────────────────────
  y -= 8;
  const totals: [string, string, boolean][] = [
    ["Subtotal", money(input.subtotalMinor, input.currency), false],
    ["Tax", money(input.taxMinor, input.currency), false],
    ["Total", money(input.totalMinor, input.currency), true],
    ...(input.paidMinor && input.paidMinor > 0
      ? ([
          ["Paid", money(input.paidMinor, input.currency), false],
          ["Balance due", money(input.totalMinor - input.paidMinor, input.currency), true],
        ] as [string, string, boolean][])
      : []),
  ];
  for (const [k, v, strong] of totals) {
    const f = strong ? bold : font;
    const size = strong ? 11 : 9.5;
    text(page, k, metaX, y, size, f, strong ? DARK : GRAY);
    text(page, v, cols.amount - f.widthOfTextAtSize(v, size), y, size, f);
    y -= strong ? 18 : 15;
  }

  // ── Notes + footer ─────────────────────────────────────────────
  if (input.notes) {
    y -= 10;
    text(page, "NOTES", margin, y, 8, bold, GRAY);
    y -= 13;
    for (const nl of wrap(input.notes, pageWidth - margin * 2, 9)) {
      text(page, nl, margin, y, 9, font, GRAY);
      y -= 12;
    }
  }
  text(page, `Generated ${new Date().toISOString().slice(0, 10)}`, margin, 40, 8, font, GRAY);

  return pdf.save();
}
