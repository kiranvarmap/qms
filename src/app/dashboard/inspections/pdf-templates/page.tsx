"use client";

import { NativeSelect, useConfirm } from "@/components/ui";
import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MoveArrowLeft as ArrowLeft, Add as Plus, Delete as Trash2, Doc as FileText, Check, CloseSmall as X, NavigationChevronUp as ChevronUp, NavigationChevronDown as ChevronDown, NavigationChevronDown as ChevronDownIcon, Text as Type, Column as Columns, Description as AlignLeft, Chart as BarChart3, Security as ShieldCheck, Signature as PenLine, Remove as Minus, Duplicate as Copy, Drag as GripVertical, Update as Save, Bold, Italic, Board as LayoutTemplate, Upload, Wand as Palette, Settings as Settings2, Link as Link2 } from "@vibe/icons";
import { Loader as Loader2 } from "@vibe/core";
import type {
  PdfTemplate, PdfTemplateConfig, PdfBlock, PdfBlockType,
  HeaderBlock, InfoFieldsBlock, TextBlock, QuestionsBlock,
  ActionsBlock, SignaturesBlock, SpacerBlock, DividerBlock, FooterBlock,
  FontFamily, QuestionType, QuestionTypeStyle,
  InspectionTemplate, TemplateSection,
} from "@/lib/types";
import { DEFAULT_PDF_CONFIG, DEFAULT_PDF_BLOCKS, QUESTION_TYPE_LABELS, buildDefaultQuestionTypeStyles } from "@/lib/types";

// ── Block palette definitions ─────────────────────────────────────
const BLOCK_PALETTE: { type: PdfBlockType; label: string; icon: React.ReactNode }[] = [
  { type: "header", label: "Header", icon: <Type className="h-3.5 w-3.5" /> },
  { type: "info_fields", label: "Info Fields", icon: <Columns className="h-3.5 w-3.5" /> },
  { type: "text", label: "Text", icon: <AlignLeft className="h-3.5 w-3.5" /> },
  { type: "questions", label: "Questions", icon: <BarChart3 className="h-3.5 w-3.5" /> },
  { type: "actions", label: "Actions", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { type: "signatures", label: "Signatures", icon: <PenLine className="h-3.5 w-3.5" /> },
  { type: "divider", label: "Divider", icon: <Minus className="h-3.5 w-3.5" /> },
  { type: "spacer", label: "Spacer", icon: <GripVertical className="h-3.5 w-3.5" /> },
  { type: "page_break", label: "Page Break", icon: <FileText className="h-3.5 w-3.5" /> },
  { type: "footer", label: "Footer", icon: <AlignLeft className="h-3.5 w-3.5" /> },
];

function makeBlock(type: PdfBlockType): PdfBlock {
  const id = `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  switch (type) {
    case "header":
      return { id, type, titleSource: "template_name", customTitle: "", showStatusBadge: true, bgColor: "#264D99", textColor: "#FFFFFF", fontSize: 14, fontFamily: "helvetica", alignment: "left", companyName: "", companyNameColor: "#666666", companyNameSize: 10, logoUrl: "", logoPosition: "left" as const, logoMaxHeight: 40 };
    case "info_fields":
      return { id, type, fields: [{ key: "site", label: "Site", enabled: true }, { key: "conductor", label: "Conducted By", enabled: true }, { key: "started", label: "Started", enabled: true }, { key: "completed", label: "Completed", enabled: true }, { key: "ncr", label: "NCR Number", enabled: true }, { key: "score", label: "Score", enabled: true }], layout: "two_column", labelColor: "#666666", valueColor: "#000000", fontSize: 9, fontFamily: "helvetica" };
    case "text":
      return { id, type, content: "", fontSize: 10, fontFamily: "helvetica", color: "#000000", bold: false, italic: false, alignment: "left", bgColor: "" };
    case "questions":
      return { id, type, showSectionHeaders: true, showSectionNumbers: true, showQuestionNumbers: true, showFlags: true, showNotes: true, showEmptyQuestions: false, sectionHeaderBg: "#EDEDF3", sectionHeaderColor: "#264D99", sectionFontSize: 10, questionFontSize: 9, questionColor: "#000000", answerFontSize: 9, answerColor: "#666666", fontFamily: "helvetica", flagColor: "#BF2626", noteColor: "#666666", dividerColor: "#CCCCCC", dividerThickness: 1, questionTypeStyles: buildDefaultQuestionTypeStyles() };
    case "actions":
      return { id, type, headerText: "CORRECTIVE ACTIONS", headerBg: "#FFF2E5", headerColor: "#BF2626", fontSize: 9, fontFamily: "helvetica" };
    case "signatures":
      return { id, type, headerText: "SIGNATURES", headerBg: "#EDF5ED", headerColor: "#278C33", fontSize: 9 };
    case "spacer":
      return { id, type, height: 20 };
    case "divider":
      return { id, type, color: "#DDDDDD", thickness: 0.5 };
    case "page_break":
      return { id, type };
    case "footer":
      return { id, type, showPageNumbers: true, showTitle: true, leftText: "", rightText: "Private & confidential", fontSize: 8, color: "#666666", logoUrl: "", logoPosition: "left" as const, logoMaxHeight: 20 };
  }
}

const ff = (f: string) => f === "courier" ? "monospace" : f === "times" ? "serif" : "sans-serif";

// ── Logo upload helper ─────────────────────────────────────────────
async function uploadLogo(file: File): Promise<string | null> {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  } catch {
    return null;
  }
}

function LogoUpload({ url, onUpload, onRemove, maxHeight = 40 }: { url: string; onUpload: (url: string) => void; onRemove: () => void; maxHeight?: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const result = await uploadLogo(file);
    if (result) onUpload(result);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      {url ? (
        <div className="flex items-center gap-2">
          <img src={url} alt="Logo" className="object-contain rounded border border-gray-200" style={{ maxHeight }} />
          <button onClick={onRemove} className="text-[10px] text-red-500 hover:underline">Remove</button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 px-2 py-1 text-[11px] border border-dashed border-gray-300 rounded hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploading ? "Uploading…" : "Upload Logo"}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleFile} className="hidden" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
export default function PdfTemplatesPage() {
  const confirmAction = useConfirm();
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [config, setConfig] = useState<PdfTemplateConfig>(DEFAULT_PDF_CONFIG);
  const [templateName, setTemplateName] = useState("Untitled Template");
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showTemplateList, setShowTemplateList] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const paletteRef = useRef<HTMLDivElement>(null);
  const templateListRef = useRef<HTMLDivElement>(null);
  const currentIdRef = useRef<string | null>(null);
  const configRef = useRef<PdfTemplateConfig>(DEFAULT_PDF_CONFIG);
  const nameRef = useRef("Untitled Template");

  // keep refs in sync
  useEffect(() => { currentIdRef.current = currentId; }, [currentId]);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { nameRef.current = templateName; }, [templateName]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) setShowPalette(false);
      if (templateListRef.current && !templateListRef.current.contains(e.target as Node)) setShowTemplateList(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openTemplate = useCallback((t: PdfTemplate) => {
    setCurrentId(t.id);
    setTemplateName(t.name);
    const cfg = (t.config as PdfTemplateConfig) ?? DEFAULT_PDF_CONFIG;
    if (!cfg.blocks || !cfg.blocks.length) cfg.blocks = [...DEFAULT_PDF_BLOCKS];
    setConfig({ ...cfg });
    setActiveBlockId(null);
    setShowTemplateList(false);
  }, []);

  // Load templates and auto-open the first one or create a new one
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/pdf-templates");
        if (!res.ok) throw new Error();
        const rows: PdfTemplate[] = await res.json();
        if (cancelled) return;
        setTemplates(rows);
        if (rows.length > 0) {
          openTemplate(rows[0]);
        } else {
          const createRes = await fetch("/api/pdf-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "Default Template", config: DEFAULT_PDF_CONFIG }),
          });
          if (createRes.ok) {
            const created: PdfTemplate = await createRes.json();
            if (cancelled) return;
            setTemplates([created]);
            openTemplate(created);
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [openTemplate]);

  const createNewTemplate = async () => {
    const res = await fetch("/api/pdf-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled Template", config: DEFAULT_PDF_CONFIG }),
    });
    if (res.ok) {
      const created: PdfTemplate = await res.json();
      setTemplates((prev) => [...prev, created]);
      openTemplate(created);
    }
  };

  // Auto-save with debounce
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const id = currentIdRef.current;
      if (!id) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/pdf-templates/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: nameRef.current, config: configRef.current }),
        });
        if (res.ok) {
          const updated: PdfTemplate = await res.json();
          setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t));
          setSaved(true);
          setTimeout(() => setSaved(false), 1500);
        }
      } catch { /* ignore */ }
      setSaving(false);
    }, 1200);
  }, []);

  const manualSave = async () => {
    if (!currentId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    try {
      const res = await fetch(`/api/pdf-templates/${currentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: templateName, config }),
      });
      if (res.ok) {
        const updated: PdfTemplate = await res.json();
        setTemplates((prev) => prev.map((t) => t.id === updated.id ? updated : t));
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!(await confirmAction("Delete this template?"))) return;
    await fetch(`/api/pdf-templates/${id}`, { method: "DELETE" });
    const remaining = templates.filter((t) => t.id !== id);
    setTemplates(remaining);
    if (currentId === id) {
      if (remaining.length > 0) openTemplate(remaining[0]);
      else { setCurrentId(null); setConfig(DEFAULT_PDF_CONFIG); }
    }
  };

  // Block operations
  const blocks = config.blocks ?? [];
  const setBlocks = useCallback((nb: PdfBlock[]) => {
    setConfig((prev) => ({ ...prev, blocks: nb }));
    scheduleSave();
  }, [scheduleSave]);

  const addBlock = (type: PdfBlockType) => {
    const nb = makeBlock(type);
    setBlocks([...blocks, nb]);
    setActiveBlockId(nb.id);
    setShowPalette(false);
  };

  const removeBlock = (id: string) => {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (activeBlockId === id) setActiveBlockId(null);
  };

  const moveBlock = (id: string, dir: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const swap = dir === "up" ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= blocks.length) return;
    const arr = [...blocks];
    [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    setBlocks(arr);
  };

  const duplicateBlock = (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (!b) return;
    const nb = { ...JSON.parse(JSON.stringify(b)), id: `b_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
    const idx = blocks.findIndex((x) => x.id === id);
    const arr = [...blocks];
    arr.splice(idx + 1, 0, nb);
    setBlocks(arr);
    setActiveBlockId(nb.id);
  };

  const updateBlock = useCallback((id: string, patch: Partial<PdfBlock>) => {
    setConfig((prev) => ({
      ...prev,
      blocks: (prev.blocks ?? []).map((b) => b.id === id ? { ...b, ...patch } as PdfBlock : b),
    }));
    scheduleSave();
  }, [scheduleSave]);

  const activeBlock = blocks.find((b) => b.id === activeBlockId) ?? null;

  if (loading) return (
    <div className="flex items-center justify-center h-full bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-sm text-gray-500">Loading editor…</p>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full bg-gray-200" onClick={() => { setActiveBlockId(null); setShowPalette(false); }}>
      {/* ── Top Toolbar ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-gray-300 px-4 py-2 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <Link href="/dashboard/inspections" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </Link>

        {/* Template selector */}
        <div className="relative" ref={templateListRef}>
          <button
            onClick={() => setShowTemplateList(!showTemplateList)}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <LayoutTemplate className="h-3.5 w-3.5 text-gray-600" />
            <span className="text-sm font-medium text-gray-800 max-w-[180px] truncate">{templateName}</span>
            <ChevronDownIcon className="h-3.5 w-3.5 text-gray-600" />
          </button>
          {showTemplateList && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-2xl z-50 overflow-hidden">
              <div className="p-2 border-b border-gray-100">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600 px-2">Templates</p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    className={cn("group flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors", currentId === t.id ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50")}
                  >
                    <div className="flex-1 truncate" onClick={() => openTemplate(t)}>
                      <FileText className="h-3.5 w-3.5 inline mr-1.5" />
                      <span className="text-sm">{t.name}</span>
                    </div>
                    {t.isDefault && <span className="text-[9px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">DEFAULT</span>}
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                      className="p-0.5 rounded hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    ><Trash2 className="h-3 w-3 text-red-600" /></button>
                  </div>
                ))}
              </div>
              <div className="p-2 border-t border-gray-100">
                <button onClick={createNewTemplate} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                  <Plus className="h-3.5 w-3.5" /> New Template
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-gray-200" />

        {/* Page settings inline */}
        <NativeSelect
 value={config.pageSize}
 onChange={(e) => { setConfig((prev) => ({ ...prev, pageSize: e.target.value as "letter" | "a4" })); scheduleSave(); }}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none hover:bg-gray-100"
        >
          <option value="letter">Letter</option><option value="a4">A4</option>
        </NativeSelect>
        <NativeSelect
 value={config.orientation}
 onChange={(e) => { setConfig((prev) => ({ ...prev, orientation: e.target.value as "portrait" | "landscape" })); scheduleSave(); }}
          className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 outline-none hover:bg-gray-100"
        >
          <option value="portrait">Portrait</option><option value="landscape">Landscape</option>
        </NativeSelect>

        <div className="flex-1" />

        {/* Save indicator */}
        {saving && <span className="text-xs text-gray-600 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>}
        {saved && !saving && <span className="text-xs text-green-600 flex items-center gap-1"><Check className="h-3 w-3" /> Saved</span>}

        <button onClick={manualSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
          <Save className="h-3.5 w-3.5" /> Save
        </button>
      </div>

      {/* ── Document Canvas ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-8">
        <div
          className="mx-auto bg-white rounded shadow-xl relative"
          style={{
            width: config.orientation === "portrait" ? 620 : 800,
            minHeight: config.orientation === "portrait" ? 877 : 620,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Template name — editable at top of page */}
          <div className="px-8 pt-6 pb-2">
            <input
              value={templateName}
              onChange={(e) => { setTemplateName(e.target.value); scheduleSave(); }}
              className="w-full text-xs text-gray-600 uppercase tracking-widest bg-transparent outline-none border-b border-transparent hover:border-gray-200 focus:border-blue-300 pb-1 transition-colors"
              placeholder="Template name…"
            />
          </div>

          {/* Blocks rendered as document content */}
          <div className="px-2 pb-4">
            {blocks.map((block, idx) => (
              <div key={block.id} className="relative group" onClick={(e) => { e.stopPropagation(); setActiveBlockId(block.id); }}>
                {/* Block content */}
                <div className={cn(
                  "transition-all rounded-sm mx-1",
                  activeBlockId === block.id
                    ? "ring-2 ring-blue-400 shadow-sm"
                    : "hover:ring-1 hover:ring-gray-300"
                )}>
                  <LiveBlock
                    block={block}
                    isActive={activeBlockId === block.id}
                    onChange={(patch) => updateBlock(block.id, patch)}
                  />
                </div>

                {/* Floating action bar — shows on hover or active */}
                <div className={cn(
                  "absolute -left-10 top-0 flex flex-col gap-0.5 transition-opacity",
                  activeBlockId === block.id ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                )}>
                  <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "up"); }} disabled={idx === 0}
                    className="p-1 rounded bg-white border border-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-20">
                    <ChevronUp className="h-3 w-3 text-gray-500" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); moveBlock(block.id, "down"); }} disabled={idx === blocks.length - 1}
                    className="p-1 rounded bg-white border border-gray-200 shadow-sm hover:bg-gray-50 disabled:opacity-20">
                    <ChevronDown className="h-3 w-3 text-gray-500" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); duplicateBlock(block.id); }}
                    className="p-1 rounded bg-white border border-gray-200 shadow-sm hover:bg-gray-50">
                    <Copy className="h-3 w-3 text-gray-500" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); removeBlock(block.id); }}
                    className="p-1 rounded bg-white border border-gray-200 shadow-sm hover:bg-red-50">
                    <Trash2 className="h-3 w-3 text-red-600" />
                  </button>
                </div>

                {/* Inline settings — appears below the block when active */}
                {activeBlockId === block.id && (
                  <div className="mx-1 mt-1 mb-2 p-3 bg-gray-50 rounded-lg border border-gray-200 shadow-sm" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">{block.type.replace(/_/g, " ")} Settings</span>
                      <button onClick={() => setActiveBlockId(null)} className="p-0.5 rounded hover:bg-gray-200"><X className="h-3 w-3 text-gray-600" /></button>
                    </div>
                    <InlineSettings block={block} onChange={(patch) => updateBlock(block.id, patch)} />
                  </div>
                )}
              </div>
            ))}

            {/* Add block button — inside the page */}
            <div className="mx-6 mt-4 mb-6 relative" ref={paletteRef} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowPalette(!showPalette)}
                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-600 font-medium hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add block
              </button>
              {showPalette && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-[420px] bg-white border border-gray-200 rounded-xl shadow-2xl p-3 grid grid-cols-2 gap-1 z-50">
                  <p className="col-span-2 text-[10px] font-bold uppercase tracking-wider text-gray-600 px-2 mb-1">Insert Block</p>
                  {BLOCK_PALETTE.map((bt) => (
                    <button
                      key={bt.type}
                      onClick={() => addBlock(bt.type)}
                      className="flex items-center gap-2.5 px-3 py-2 text-left rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      <span className="text-gray-600">{bt.icon}</span>
                      <span className="text-xs font-medium text-gray-700">{bt.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Page footer preview at bottom of page */}
          {blocks.find((b) => b.type === "footer") && (
            <div className="absolute bottom-0 left-0 right-0 px-8 py-3 border-t border-gray-100">
              {(() => {
                const ftr = blocks.find((b) => b.type === "footer") as FooterBlock | undefined;
                if (!ftr) return null;
                return (
                  <div className="flex justify-between" style={{ fontSize: ftr.fontSize + 2, color: ftr.color }}>
                    <span>{ftr.showTitle ? "Document Title" : ""} {ftr.leftText}</span>
                    <span>{ftr.rightText} {ftr.showPageNumbers ? "— 1 / 3" : ""}</span>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// QuestionsCanvasEditor — each question type is a separate editable card
// ════════════════════════════════════════════════════════════════════
const SAMPLE_ANSWERS: Record<string, string> = {
  yes_no_na: "Yes", text: "Sample text answer", long_text: "This is a longer text answer with more detail...",
  number: "42", checkbox: "[x] Yes", date: "Apr 25, 2026", photo: "[Photo attached]",
  dropdown: "Option A", multiple_choice: "Option B", multiple_selection: "Option A, Option C",
  rating: "**** o (4/5)", signature: "[Signature captured]", table: "[Table data]",
  document_number: "DOC-2026-001", site_name: "Main Facility", asset_name: "Crane #5", company_name: "Acme Corp",
};

// Question types that need full-width (answer below, not side-by-side)
const FULL_WIDTH_TYPES = new Set<string>(["signature", "table", "long_text"]);

function QuestionsCanvasEditor({ b, isActive, onChange }: { b: QuestionsBlock; isActive: boolean; onChange: (p: Partial<QuestionsBlock>) => void }) {
  const [editingType, setEditingType] = useState<QuestionType | null>(null);
  const [editingSection, setEditingSection] = useState(false);
  const [inspTemplates, setInspTemplates] = useState<InspectionTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const typeStyles = b.questionTypeStyles ?? buildDefaultQuestionTypeStyles();

  const updateTypeStyle = (qt: QuestionType, patch: Partial<QuestionTypeStyle>) => {
    onChange({ questionTypeStyles: { ...typeStyles, [qt]: { ...typeStyles[qt], ...patch } } } as Partial<QuestionsBlock>);
  };

  // Load inspection templates the first time the block is active
  useEffect(() => {
    if (!isActive || inspTemplates.length > 0) return;
    setLoadingTemplates(true);
    fetch("/api/inspection-templates")
      .then((r) => r.ok ? r.json() : [])
      .then((data: InspectionTemplate[]) => setInspTemplates(data))
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, [isActive, inspTemplates.length]);

  const selectedTemplate = inspTemplates.find((t) => t.id === selectedTemplateId);
  const sections: TemplateSection[] = selectedTemplate?.sections ?? [];

  // Determine which question types exist in the selected template (or all if none selected)
  const usedTypes: QuestionType[] = selectedTemplate
    ? [...new Set(sections.flatMap((s) => s.questions.map((q) => q.type as QuestionType)))]
    : (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]);

  return (
    <div className="px-4 py-3 space-y-0" onClick={(e) => e.stopPropagation()}>
      {/* ── Inspection Template Selector ─────────────────────────── */}
      {isActive && (
        <div className="flex items-center gap-2 mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
          <Link2 className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex-shrink-0">Preview with:</span>
          <NativeSelect
 value={selectedTemplateId}
 onChange={(e) => setSelectedTemplateId(e.target.value)}
            className="flex-1 text-[11px] bg-white border border-blue-200 rounded px-2 py-1 outline-none"
          >
            <option value="">All Question Types (Default)</option>
            {inspTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.title} ({t.sections?.length || 0} sections)</option>
            ))}
          </NativeSelect>
          {loadingTemplates && <Loader2 className="h-3 w-3 animate-spin text-blue-600" />}
        </div>
      )}

      {/* ── Section Header (editable on canvas) ─────────────────── */}
      {b.showSectionHeaders && (
        <div className="mb-2">
          {(selectedTemplate ? sections : [{ id: "sample", title: "Section Title", questions: [], position: 0, templateId: "", pageNumber: 1, isRepeatable: false, maxRepetitions: null, requiresSignoff: false, signoffRoles: null }]).map((sec, si) => (
            <div key={sec.id} className="mb-3">
              <div
                onClick={(e) => { e.stopPropagation(); setEditingSection(!editingSection); setEditingType(null); }}
                className={cn(
                  "rounded-lg px-4 py-2 font-bold uppercase tracking-wide cursor-pointer transition-all",
                  editingSection ? "ring-2 ring-blue-400" : "hover:ring-1 hover:ring-gray-300"
                )}
                style={{ backgroundColor: b.sectionHeaderBg, color: b.sectionHeaderColor, fontSize: b.sectionFontSize + 1, fontFamily: ff(b.fontFamily) }}
              >
                {b.showSectionNumbers ? `${si + 1}. ` : ""}{sec.title}
              </div>
              {/* Section style editor — inline on canvas */}
              {editingSection && si === 0 && (
                <div className="mt-1 p-2.5 bg-white rounded-lg border border-blue-200 shadow-md space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">Section Header Style</span>
                    <button onClick={() => setEditingSection(false)} className="p-0.5 rounded hover:bg-gray-100"><X className="h-3 w-3 text-gray-600" /></button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] text-gray-500">BG:</span><Clr value={b.sectionHeaderBg} onChange={(v) => onChange({ sectionHeaderBg: v })} />
                    <span className="text-[10px] text-gray-500">Text:</span><Clr value={b.sectionHeaderColor} onChange={(v) => onChange({ sectionHeaderColor: v })} />
                    <span className="text-[10px] text-gray-500">Size:</span><SizeBtn value={b.sectionFontSize} onChange={(v) => onChange({ sectionFontSize: v })} />
                  </div>
                </div>
              )}

              {/* Questions for this section */}
              <div className="mt-1 space-y-0">
                {selectedTemplate ? (
                  // Real questions from inspection template
                  sec.questions
                    .sort((a, b) => a.position - b.position)
                    .map((q, qi) => {
                      const qt = q.type as QuestionType;
                      return (
                        <QuestionTypeCard
                          key={q.id}
                          questionType={qt}
                          questionTitle={q.title}
                          questionNum={b.showQuestionNumbers ? `${si + 1}.${qi + 1}` : ""}
                          block={b}
                          typeStyles={typeStyles}
                          isEditing={editingType === qt}
                          onEdit={() => { setEditingType(editingType === qt ? null : qt); setEditingSection(false); }}
                          onUpdateStyle={(patch) => updateTypeStyle(qt, patch)}
                        />
                      );
                    })
                ) : (
                  // All question types as separate cards
                  (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((qt, qi) => (
                    <QuestionTypeCard
                      key={qt}
                      questionType={qt}
                      questionTitle={QUESTION_TYPE_LABELS[qt]}
                      questionNum={b.showQuestionNumbers ? `${si + 1}.${qi + 1}` : ""}
                      block={b}
                      typeStyles={typeStyles}
                      isEditing={editingType === qt}
                      onEdit={() => { setEditingType(editingType === qt ? null : qt); setEditingSection(false); }}
                      onUpdateStyle={(patch) => updateTypeStyle(qt, patch)}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* If section headers are off, just show type cards directly */}
      {!b.showSectionHeaders && (
        <div className="space-y-0">
          {selectedTemplate ? (
            sections.flatMap((sec) => sec.questions).sort((a, b) => a.position - b.position).map((q, qi) => {
              const qt = q.type as QuestionType;
              return (
                <QuestionTypeCard
                  key={q.id}
                  questionType={qt}
                  questionTitle={q.title}
                  questionNum={b.showQuestionNumbers ? `${qi + 1}` : ""}
                  block={b}
                  typeStyles={typeStyles}
                  isEditing={editingType === qt}
                  onEdit={() => { setEditingType(editingType === qt ? null : qt); setEditingSection(false); }}
                  onUpdateStyle={(patch) => updateTypeStyle(qt, patch)}
                />
              );
            })
          ) : (
            (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((qt, qi) => (
              <QuestionTypeCard
                key={qt}
                questionType={qt}
                questionTitle={QUESTION_TYPE_LABELS[qt]}
                questionNum={b.showQuestionNumbers ? `${qi + 1}` : ""}
                block={b}
                typeStyles={typeStyles}
                isEditing={editingType === qt}
                onEdit={() => { setEditingType(editingType === qt ? null : qt); setEditingSection(false); }}
                onUpdateStyle={(patch) => updateTypeStyle(qt, patch)}
              />
            ))
          )}
        </div>
      )}

      {b.showFlags && (
        <>
          <div className="mx-4 border-t border-gray-200" />
          <p className="px-4 pt-2 font-bold text-xs" style={{ color: b.flagColor }}>! FLAGGED</p>
        </>
      )}
      {b.showNotes && <p className="px-4 italic text-xs" style={{ color: b.noteColor }}>Note: Needs recertification by May</p>}

      {/* Used types summary */}
      {selectedTemplate && isActive && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-600">
            Types used in this template: {usedTypes.map((t) => QUESTION_TYPE_LABELS[t]).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Individual Question Type Card ──────────────────────────────────
function QuestionTypeCard({
  questionType: qt, questionTitle, questionNum, block: b, typeStyles, isEditing, onEdit, onUpdateStyle,
}: {
  questionType: QuestionType;
  questionTitle: string;
  questionNum: string;
  block: QuestionsBlock;
  typeStyles: Record<QuestionType, QuestionTypeStyle>;
  isEditing: boolean;
  onEdit: () => void;
  onUpdateStyle: (patch: Partial<QuestionTypeStyle>) => void;
}) {
  const ts = typeStyles[qt];
  const qColor = ts?.questionColor || b.questionColor;
  const aColor = ts?.answerColor || b.answerColor;
  const qSize = ts?.questionFontSize || b.questionFontSize;
  const aSize = ts?.answerFontSize || b.answerFontSize;
  const bgc = ts?.bgColor || "";

  const isFullWidth = FULL_WIDTH_TYPES.has(qt);
  const answer = SAMPLE_ANSWERS[qt] || "N/A";

  return (
    <div className="relative">
      <div
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className={cn(
          "border border-transparent px-4 py-2.5 cursor-pointer transition-all",
          isEditing ? "border-blue-400 ring-2 ring-blue-200 shadow-sm rounded-lg" : "hover:border-gray-200 hover:bg-gray-50/50"
        )}
      >
        {isFullWidth ? (
          <div>
            <p className="font-semibold" style={{ color: qColor, fontSize: qSize + 2, fontFamily: ff(b.fontFamily) }}>
              {questionNum ? `${questionNum}. ` : ""}{questionTitle}
            </p>
            <p className="pl-2 mt-1" style={{ color: aColor, fontSize: aSize + 2, fontFamily: ff(b.fontFamily) }}>
              {answer}
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="font-semibold flex-1" style={{ color: qColor, fontSize: qSize + 2, fontFamily: ff(b.fontFamily) }}>
              {questionNum ? `${questionNum}. ` : ""}{questionTitle}
            </p>
            {bgc && bgc !== "#ffffff" && bgc !== "#FFFFFF" && bgc !== "" ? (
              <span
                className="px-3 py-1 rounded text-gray-900 text-right flex-shrink-0"
                style={{ backgroundColor: bgc, fontSize: aSize + 2, fontFamily: ff(b.fontFamily) }}
              >
                {answer}
              </span>
            ) : (
              <p className="text-right flex-shrink-0" style={{ color: aColor, fontSize: aSize + 2, fontFamily: ff(b.fontFamily) }}>
                {answer}
              </p>
            )}
          </div>
        )}
        {isEditing && (
          <div className="flex items-center gap-2 mt-1">
            <Palette className="h-3 w-3 text-blue-600 flex-shrink-0" />
            <span className="text-[9px] text-blue-600">Click to edit style</span>
          </div>
        )}
      </div>
      {/* Row border — uses block divider settings */}
      <div className="mx-4" style={{ borderBottomWidth: Math.max(b.dividerThickness ?? 0.5, 1), borderBottomStyle: "solid", borderBottomColor: b.dividerColor ?? "#DDDDDD" }} />

      {/* ── Inline Style Editor (shows when this card is clicked) ── */}
      {isEditing && (
        <div className="mx-1 mb-1 p-3 bg-white rounded-lg border border-blue-200 shadow-lg space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
              <Settings2 className="h-3 w-3 inline mr-1" />
              {QUESTION_TYPE_LABELS[qt]} Style
            </span>
            <button onClick={onEdit} className="p-0.5 rounded hover:bg-gray-100"><X className="h-3 w-3 text-gray-600" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold uppercase text-gray-600">Question</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500">Color:</span>
                <Clr value={ts?.questionColor ?? b.questionColor} onChange={(v) => onUpdateStyle({ questionColor: v })} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500">Size:</span>
                <SizeBtn value={ts?.questionFontSize ?? b.questionFontSize} onChange={(v) => onUpdateStyle({ questionFontSize: v })} />
                <span className="text-[9px] text-gray-600">pt</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[9px] font-bold uppercase text-gray-600">Answer</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500">Color:</span>
                <Clr value={ts?.answerColor ?? b.answerColor} onChange={(v) => onUpdateStyle({ answerColor: v })} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-500">Size:</span>
                <SizeBtn value={ts?.answerFontSize ?? b.answerFontSize} onChange={(v) => onUpdateStyle({ answerFontSize: v })} />
                <span className="text-[9px] text-gray-600">pt</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
            <span className="text-[10px] text-gray-500">Background:</span>
            <Clr value={ts?.bgColor || "#ffffff"} onChange={(v) => onUpdateStyle({ bgColor: v })} />
            {ts?.bgColor && ts.bgColor !== "" && (
              <button onClick={() => onUpdateStyle({ bgColor: "" })} className="text-[9px] text-red-600 hover:text-red-600">Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// LiveBlock — renders edit-in-place block content on the document
// ════════════════════════════════════════════════════════════════════
function LiveBlock({ block: b, isActive, onChange }: { block: PdfBlock; isActive: boolean; onChange: (p: Partial<PdfBlock>) => void }) {
  switch (b.type) {
    case "header":
      return (
        <div className="px-6 py-4">
          {/* Logo display */}
          {b.logoUrl && (
            <div className="mb-2" style={{ textAlign: b.logoPosition }}>
              <img src={b.logoUrl} alt="Logo" className="inline-block object-contain" style={{ maxHeight: b.logoMaxHeight }} />
            </div>
          )}
          {(b.companyName || isActive) && (
            <input
              value={b.companyName}
              onChange={(e) => onChange({ companyName: e.target.value } as Partial<HeaderBlock>)}
              placeholder="Company name…"
              className="w-full bg-transparent outline-none mb-2 placeholder-gray-300"
              style={{ color: b.companyNameColor, fontSize: b.companyNameSize + 2, fontWeight: 600, fontFamily: ff(b.fontFamily) }}
            />
          )}
          <div className="rounded-lg px-4 py-3 flex items-center gap-3" style={{ backgroundColor: b.bgColor }}>
            {b.titleSource === "custom" ? (
              <input
                value={b.customTitle}
                onChange={(e) => onChange({ customTitle: e.target.value } as Partial<HeaderBlock>)}
                placeholder="Enter title…"
                className="flex-1 bg-transparent outline-none font-bold placeholder-white/50"
                style={{ color: b.textColor, fontSize: Math.min(b.fontSize + 2, 22), fontFamily: ff(b.fontFamily), textAlign: b.alignment }}
              />
            ) : (
              <span className="flex-1 font-bold" style={{ color: b.textColor, fontSize: Math.min(b.fontSize + 2, 22), fontFamily: ff(b.fontFamily), textAlign: b.alignment }}>
                {"{{ Inspection Title }}"}
              </span>
            )}
            {b.showStatusBadge && <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded-md font-bold flex-shrink-0">COMPLETED</span>}
          </div>
        </div>
      );

    case "info_fields": {
      const active = b.fields.filter((f) => f.enabled);
      return (
        <div className={cn("px-6 py-3 gap-x-6 gap-y-1.5", b.layout === "two_column" ? "grid grid-cols-2" : "flex flex-col gap-1.5")}>
          {active.map((f) => (
            <div key={f.key} className="flex gap-1.5 items-baseline" style={{ fontSize: b.fontSize + 2, fontFamily: ff(b.fontFamily) }}>
              <span className="font-semibold" style={{ color: b.labelColor }}>{f.label}:</span>
              <span style={{ color: b.valueColor }}>Sample value</span>
            </div>
          ))}
          {active.length === 0 && <span className="text-xs text-gray-700 italic">No fields enabled — click to configure</span>}
        </div>
      );
    }

    case "text":
      return (
        <div className="px-6 py-2" style={{ backgroundColor: b.bgColor || undefined }}>
          <textarea
            value={b.content}
            onChange={(e) => onChange({ content: e.target.value } as Partial<TextBlock>)}
            placeholder="Click to type text…"
            rows={Math.max(2, (b.content?.split("\n").length ?? 0) + 1)}
            className="w-full bg-transparent outline-none resize-none placeholder-gray-300"
            style={{
              fontSize: b.fontSize + 2, color: b.color, fontWeight: b.bold ? 700 : 400,
              fontStyle: b.italic ? "italic" : "normal", fontFamily: ff(b.fontFamily),
              textAlign: b.alignment as React.CSSProperties["textAlign"],
            }}
          />
        </div>
      );

    case "questions": {
      return <QuestionsCanvasEditor b={b} isActive={isActive} onChange={onChange as (p: Partial<QuestionsBlock>) => void} />;
    }

    case "actions":
      return (
        <div className="px-6 py-3">
          <div className="rounded-md px-3 py-1.5 font-bold uppercase tracking-wide" style={{ backgroundColor: b.headerBg, color: b.headerColor, fontSize: b.fontSize + 1, fontFamily: ff(b.fontFamily) }}>
            {b.headerText}
          </div>
          <div className="pl-3 mt-1.5 space-y-1 text-xs text-gray-500">
            <p>• Replace damaged guardrail — <span className="text-red-500 font-medium">High</span></p>
            <p>• Schedule fire drill — <span className="text-yellow-600 font-medium">Medium</span></p>
          </div>
        </div>
      );

    case "signatures":
      return (
        <div className="px-6 py-3">
          <div className="rounded-md px-3 py-1.5 font-bold uppercase tracking-wide" style={{ backgroundColor: b.headerBg, color: b.headerColor, fontSize: b.fontSize + 1 }}>
            {b.headerText}
          </div>
          <div className="flex gap-8 mt-2 pl-3">
            <div className="text-xs text-gray-500">
              <div className="w-20 h-8 border-b border-gray-300 mb-1" />
              <p className="font-medium text-gray-700">John Smith</p>
              <p>Inspector — Apr 25, 2026</p>
            </div>
            <div className="text-xs text-gray-500">
              <div className="w-20 h-8 border-b border-gray-300 mb-1" />
              <p className="font-medium text-gray-700">Jane Doe</p>
              <p>Supervisor — Apr 25, 2026</p>
            </div>
          </div>
        </div>
      );

    case "spacer":
      return (
        <div className="flex items-center justify-center text-gray-700 transition-all" style={{ height: Math.min(b.height, 80) }}>
          <span className="text-[10px] border border-dashed border-gray-200 px-2 py-0.5 rounded">↕ Spacer {b.height}pt</span>
        </div>
      );

    case "divider":
      return <div className="px-6 py-3"><hr style={{ borderColor: b.color, borderWidth: b.thickness }} /></div>;

    case "page_break":
      return (
        <div className="flex items-center gap-3 py-3 px-6">
          <span className="flex-1 border-t-2 border-dashed border-gray-300" />
          <span className="text-[10px] font-bold tracking-widest text-gray-600 bg-gray-50 px-3 py-1 rounded-full">PAGE BREAK</span>
          <span className="flex-1 border-t-2 border-dashed border-gray-300" />
        </div>
      );

    case "footer":
      return (
        <div className="px-6 py-2 border-t border-gray-100">
          {b.logoUrl && (
            <div className="mb-1" style={{ textAlign: b.logoPosition }}>
              <img src={b.logoUrl} alt="Footer Logo" className="inline-block object-contain" style={{ maxHeight: b.logoMaxHeight || 20 }} />
            </div>
          )}
          <div className="flex items-center justify-between" style={{ fontSize: b.fontSize + 2, color: b.color }}>
            <span>{b.showTitle ? "{{ Title }}" : ""} {b.leftText}</span>
            <span>{b.rightText} {b.showPageNumbers ? "— 1/3" : ""}</span>
          </div>
        </div>
      );
  }
}

// ════════════════════════════════════════════════════════════════════
// InlineSettings — compact settings that appear below active block
// ════════════════════════════════════════════════════════════════════
function InlineSettings({ block, onChange }: { block: PdfBlock; onChange: (p: Partial<PdfBlock>) => void }) {
  switch (block.type) {
    case "header": return <HeaderInline b={block} o={onChange} />;
    case "info_fields": return <InfoFieldsInline b={block} o={onChange} />;
    case "text": return <TextInline b={block} o={onChange} />;
    case "questions": return <QuestionsInline b={block} o={onChange} />;
    case "actions": return <ActionsInline b={block} o={onChange} />;
    case "signatures": return <SigInline b={block} o={onChange} />;
    case "spacer": return <div className="flex items-center gap-2"><label className="text-xs text-gray-500">Height:</label><input type="range" min={5} max={120} value={block.height} onChange={(e) => onChange({ height: parseInt(e.target.value) } as Partial<SpacerBlock>)} className="flex-1" /><span className="text-xs text-gray-500 w-8">{block.height}pt</span></div>;
    case "divider": return <div className="flex items-center gap-3"><Clr value={block.color} onChange={(v) => onChange({ color: v } as Partial<DividerBlock>)} /><label className="text-xs text-gray-500">Thickness:</label><input type="range" min={0.5} max={3} step={0.25} value={block.thickness} onChange={(e) => onChange({ thickness: parseFloat(e.target.value) } as Partial<DividerBlock>)} className="w-20" /></div>;
    case "page_break": return <p className="text-xs text-gray-600 italic">Forces a new page in the PDF. No settings.</p>;
    case "footer": return <FooterInline b={block} o={onChange} />;
  }
}

// ── Micro-components ──────────────────────────────────────────────
function Clr({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="w-5 h-5 rounded border border-gray-200 cursor-pointer p-0" />
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-16 text-[10px] border border-gray-200 rounded px-1 py-0.5 outline-none font-mono" />
    </div>
  );
}

function Tog({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <button type="button" onClick={() => onChange(!checked)} className={cn("relative w-6 h-3.5 rounded-full transition-colors", checked ? "bg-blue-500" : "bg-gray-300")}>
        <span className={cn("absolute top-[2px] left-[2px] w-2.5 h-2.5 rounded-full bg-white shadow transition-transform", checked && "translate-x-2.5")} />
      </button>
      <span className="text-[11px] text-gray-600">{label}</span>
    </label>
  );
}

function FontBtn({ value, onChange }: { value: FontFamily; onChange: (v: FontFamily) => void }) {
  return (
    <NativeSelect value={value} onChange={(e) => onChange(e.target.value as FontFamily)} className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none">
      <option value="helvetica">Helvetica</option><option value="times">Times</option><option value="courier">Courier</option>
    </NativeSelect>
  );
}

function SizeBtn({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <input type="number" min={6} max={30} value={value} onChange={(e) => onChange(parseInt(e.target.value) || 10)} className="w-10 text-[11px] text-center border border-gray-200 rounded px-1 py-0.5 outline-none" />;
}

// ── Inline settings per block type ────────────────────────────────
function HeaderInline({ b, o }: { b: HeaderBlock; o: (p: Partial<HeaderBlock>) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-gray-600">Logo:</span>
        <LogoUpload url={b.logoUrl ?? ""} onUpload={(url) => o({ logoUrl: url })} onRemove={() => o({ logoUrl: "" })} maxHeight={40} />
        {b.logoUrl && (
          <NativeSelect value={b.logoPosition ?? "left"} onChange={(e) => o({ logoPosition: e.target.value as "left" | "center" | "right" })} className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none">
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </NativeSelect>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect value={b.titleSource} onChange={(e) => o({ titleSource: e.target.value as "template_name" | "custom" })} className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-1 outline-none">
          <option value="template_name">Auto title</option><option value="custom">Custom title</option>
        </NativeSelect>
        <FontBtn value={b.fontFamily} onChange={(v) => o({ fontFamily: v })} />
        <SizeBtn value={b.fontSize} onChange={(v) => o({ fontSize: v })} />
        <NativeSelect value={b.alignment} onChange={(e) => o({ alignment: e.target.value as HeaderBlock["alignment"] })} className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none">
          <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
        </NativeSelect>
        <Tog checked={b.showStatusBadge} onChange={(v) => o({ showStatusBadge: v })} label="Badge" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-gray-600">BG:</span><Clr value={b.bgColor} onChange={(v) => o({ bgColor: v })} />
        <span className="text-[10px] text-gray-600">Text:</span><Clr value={b.textColor} onChange={(v) => o({ textColor: v })} />
        <span className="text-[10px] text-gray-600">Company:</span><Clr value={b.companyNameColor} onChange={(v) => o({ companyNameColor: v })} />
      </div>
    </div>
  );
}

function InfoFieldsInline({ b, o }: { b: InfoFieldsBlock; o: (p: Partial<InfoFieldsBlock>) => void }) {
  const toggle = (key: string) => o({ fields: b.fields.map((f) => f.key === key ? { ...f, enabled: !f.enabled } : f) });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {b.fields.map((f) => (
          <label key={f.key} className="flex items-center gap-1 cursor-pointer">
            <input type="checkbox" checked={f.enabled} onChange={() => toggle(f.key)} className="w-3 h-3 rounded" />
            <span className="text-[11px] text-gray-600">{f.label}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect value={b.layout} onChange={(e) => o({ layout: e.target.value as "vertical" | "two_column" })} className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none">
          <option value="two_column">Two columns</option><option value="vertical">Single column</option>
        </NativeSelect>
        <FontBtn value={b.fontFamily} onChange={(v) => o({ fontFamily: v })} />
        <SizeBtn value={b.fontSize} onChange={(v) => o({ fontSize: v })} />
        <span className="text-[10px] text-gray-600">Label:</span><Clr value={b.labelColor} onChange={(v) => o({ labelColor: v })} />
        <span className="text-[10px] text-gray-600">Value:</span><Clr value={b.valueColor} onChange={(v) => o({ valueColor: v })} />
      </div>
    </div>
  );
}

function TextInline({ b, o }: { b: TextBlock; o: (p: Partial<TextBlock>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FontBtn value={b.fontFamily} onChange={(v) => o({ fontFamily: v })} />
      <SizeBtn value={b.fontSize} onChange={(v) => o({ fontSize: v })} />
      <Clr value={b.color} onChange={(v) => o({ color: v })} />
      <button onClick={() => o({ bold: !b.bold })} className={cn("p-1 rounded border", b.bold ? "bg-blue-100 border-blue-300" : "border-gray-200 hover:bg-gray-100")}>
        <Bold className="h-3 w-3" />
      </button>
      <button onClick={() => o({ italic: !b.italic })} className={cn("p-1 rounded border", b.italic ? "bg-blue-100 border-blue-300" : "border-gray-200 hover:bg-gray-100")}>
        <Italic className="h-3 w-3" />
      </button>
      <NativeSelect value={b.alignment} onChange={(e) => o({ alignment: e.target.value as TextBlock["alignment"] })} className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none">
        <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
      </NativeSelect>
    </div>
  );
}

function QuestionsInline({ b, o }: { b: QuestionsBlock; o: (p: Partial<QuestionsBlock>) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        <Tog checked={b.showSectionHeaders} onChange={(v) => o({ showSectionHeaders: v })} label="Sections" />
        <Tog checked={b.showSectionNumbers} onChange={(v) => o({ showSectionNumbers: v })} label="Section #" />
        <Tog checked={b.showQuestionNumbers} onChange={(v) => o({ showQuestionNumbers: v })} label="Question #" />
        <Tog checked={b.showFlags} onChange={(v) => o({ showFlags: v })} label="Flags" />
        <Tog checked={b.showNotes} onChange={(v) => o({ showNotes: v })} label="Notes" />
        <Tog checked={b.showEmptyQuestions} onChange={(v) => o({ showEmptyQuestions: v })} label="Empty Q's" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FontBtn value={b.fontFamily} onChange={(v) => o({ fontFamily: v })} />
        <span className="text-[10px] text-gray-600">Flag:</span><Clr value={b.flagColor} onChange={(v) => o({ flagColor: v })} />
        <span className="text-[10px] text-gray-600">Note:</span><Clr value={b.noteColor} onChange={(v) => o({ noteColor: v })} />
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
        <span className="text-[10px] text-gray-600">Row Divider:</span>
        <Clr value={b.dividerColor ?? "#DDDDDD"} onChange={(v) => o({ dividerColor: v })} />
        <span className="text-[10px] text-gray-600">Width:</span>
        <input type="range" min={0.25} max={3} step={0.25} value={b.dividerThickness ?? 0.5} onChange={(e) => o({ dividerThickness: parseFloat(e.target.value) })} className="w-16" />
        <span className="text-[9px] text-gray-600">{b.dividerThickness ?? 0.5}pt</span>
      </div>
      <p className="text-[10px] text-gray-600 italic">Click any question type card or section header on the canvas above to customize individually.</p>
    </div>
  );
}

function ActionsInline({ b, o }: { b: ActionsBlock; o: (p: Partial<ActionsBlock>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={b.headerText} onChange={(e) => o({ headerText: e.target.value })} className="text-[11px] border border-gray-200 rounded px-2 py-0.5 outline-none w-40" />
      <FontBtn value={b.fontFamily} onChange={(v) => o({ fontFamily: v })} />
      <SizeBtn value={b.fontSize} onChange={(v) => o({ fontSize: v })} />
      <span className="text-[10px] text-gray-600">BG:</span><Clr value={b.headerBg} onChange={(v) => o({ headerBg: v })} />
      <span className="text-[10px] text-gray-600">Color:</span><Clr value={b.headerColor} onChange={(v) => o({ headerColor: v })} />
    </div>
  );
}

function SigInline({ b, o }: { b: SignaturesBlock; o: (p: Partial<SignaturesBlock>) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={b.headerText} onChange={(e) => o({ headerText: e.target.value })} className="text-[11px] border border-gray-200 rounded px-2 py-0.5 outline-none w-40" />
      <SizeBtn value={b.fontSize} onChange={(v) => o({ fontSize: v })} />
      <span className="text-[10px] text-gray-600">BG:</span><Clr value={b.headerBg} onChange={(v) => o({ headerBg: v })} />
      <span className="text-[10px] text-gray-600">Color:</span><Clr value={b.headerColor} onChange={(v) => o({ headerColor: v })} />
    </div>
  );
}

function FooterInline({ b, o }: { b: FooterBlock; o: (p: Partial<FooterBlock>) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] text-gray-600">Logo:</span>
        <LogoUpload url={b.logoUrl ?? ""} onUpload={(url) => o({ logoUrl: url })} onRemove={() => o({ logoUrl: "" })} maxHeight={20} />
        {b.logoUrl && (
          <NativeSelect value={b.logoPosition ?? "left"} onChange={(e) => o({ logoPosition: e.target.value as "left" | "center" | "right" })} className="text-[11px] bg-white border border-gray-200 rounded px-1.5 py-0.5 outline-none">
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </NativeSelect>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Tog checked={b.showPageNumbers} onChange={(v) => o({ showPageNumbers: v })} label="Page #" />
        <Tog checked={b.showTitle} onChange={(v) => o({ showTitle: v })} label="Title" />
        <input value={b.leftText} onChange={(e) => o({ leftText: e.target.value })} placeholder="Left text…" className="text-[11px] border border-gray-200 rounded px-2 py-0.5 outline-none w-28" />
        <input value={b.rightText} onChange={(e) => o({ rightText: e.target.value })} placeholder="Right text…" className="text-[11px] border border-gray-200 rounded px-2 py-0.5 outline-none w-28" />
        <SizeBtn value={b.fontSize} onChange={(v) => o({ fontSize: v })} />
        <Clr value={b.color} onChange={(v) => o({ color: v })} />
      </div>
    </div>
  );
}
