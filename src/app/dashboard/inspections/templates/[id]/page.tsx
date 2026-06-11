"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Settings2,
  CheckSquare,
  Type,
  Hash,
  Calendar,
  Camera,
  ChevronRight as DropdownIcon,
  List,
  Star,
  PenLine,
  GripVertical,
  Eye,
  EyeOff,
  Loader2,
  Check,
  Copy,
  Table,
  FileText,
  MapPin,
  Building,
  Briefcase,
  GitBranch,
  Repeat,
  ShieldCheck,
  ListChecks,
  X,
  ClipboardList,
  Upload,
} from "lucide-react";
import type { InspectionTemplate, TemplateQuestion, TemplateSection, QuestionType, ConditionalRule, PdfTemplate } from "@/lib/types";

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "yes_no_na", label: "Yes / No / N/A", icon: <CheckSquare className="h-4 w-4" />, desc: "Pass/fail with N/A option" },
  { value: "text", label: "Short Text", icon: <Type className="h-4 w-4" />, desc: "Short text answer" },
  { value: "long_text", label: "Long Text", icon: <FileText className="h-4 w-4" />, desc: "Multi-line text answer" },
  { value: "number", label: "Number", icon: <Hash className="h-4 w-4" />, desc: "Numeric value" },
  { value: "checkbox", label: "Checkbox", icon: <Check className="h-4 w-4" />, desc: "Single checkbox toggle" },
  { value: "date", label: "Date", icon: <Calendar className="h-4 w-4" />, desc: "Date picker" },
  { value: "photo", label: "Photo", icon: <Camera className="h-4 w-4" />, desc: "Image upload" },
  { value: "dropdown", label: "Dropdown", icon: <DropdownIcon className="h-4 w-4" />, desc: "Single select from list" },
  { value: "multiple_choice", label: "Multiple Choice", icon: <List className="h-4 w-4" />, desc: "Select one option" },
  { value: "multiple_selection", label: "Multiple Selection", icon: <ListChecks className="h-4 w-4" />, desc: "Select multiple options" },
  { value: "rating", label: "Rating", icon: <Star className="h-4 w-4" />, desc: "1–5 star rating" },
  { value: "signature", label: "Signature", icon: <PenLine className="h-4 w-4" />, desc: "Sign-off field" },
  { value: "table", label: "Table", icon: <Table className="h-4 w-4" />, desc: "Grid with columns & rows" },
  { value: "document_number", label: "Document #", icon: <FileText className="h-4 w-4" />, desc: "Auto/manual doc number" },
  { value: "site_name", label: "Site Name", icon: <MapPin className="h-4 w-4" />, desc: "Auto-populated site" },
  { value: "asset_name", label: "Asset Name", icon: <Briefcase className="h-4 w-4" />, desc: "Auto-populated asset" },
  { value: "company_name", label: "Company Name", icon: <Building className="h-4 w-4" />, desc: "Auto-populated company" },
];

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export default function TemplateBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [template, setTemplate] = useState<InspectionTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [descValue, setDescValue] = useState("");
  const [showTypeModal, setShowTypeModal] = useState<string | null>(null);

  // PDF template chooser state
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
  const [selectedPdfTemplateId, setSelectedPdfTemplateId] = useState<string | null>(null);
  const [loadingPdfTemplates, setLoadingPdfTemplates] = useState(false);
  const [creatingPdfTemplate, setCreatingPdfTemplate] = useState(false);
  const [newPdfTemplateName, setNewPdfTemplateName] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/inspection-templates/${id}`);
    if (!res.ok) { router.push("/dashboard/inspections"); return; }
    const data: InspectionTemplate = await res.json();
    setTemplate(data);
    setTitleValue(data.title);
    setDescValue(data.description || "");
    if (!activeSectionId && data.sections.length > 0) {
      setActiveSectionId(data.sections[0].id);
    }
    setLoading(false);
  }, [id, router, activeSectionId]);

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save template meta ─────────────────────────────────────────
  // Use a ref so the debounced function is stable across renders.
  const idRef = useRef(id);
  useEffect(() => { idRef.current = id; }, [id]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saveMeta = useCallback(
    debounce(async (title: string, desc: string) => {
      setSaving(true);
      await fetch(`/api/inspection-templates/${idRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: desc }),
      });
      setSaving(false);
    }, 800),
    [] // stable: debounce is created once; id is read via idRef
  );

  const handleTitleChange = (v: string) => {
    setTitleValue(v);
    setTemplate((t) => t ? { ...t, title: v } : t);
    saveMeta(v, descValue);
  };
  const handleDescChange = (v: string) => {
    setDescValue(v);
    setTemplate((t) => t ? { ...t, description: v } : t);
    saveMeta(titleValue, v);
  };

  const togglePublish = async () => {
    if (!template) return;
    if (template.isPublished) {
      // Unpublish immediately
      setTemplate({ ...template, isPublished: false });
      await fetch(`/api/inspection-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: false }),
      });
    } else {
      // Show publish modal with PDF template chooser
      setLoadingPdfTemplates(true);
      setShowPublishModal(true);
      try {
        const res = await fetch("/api/pdf-templates");
        if (res.ok) {
          const templates: PdfTemplate[] = await res.json();
          setPdfTemplates(templates);
          // Pre-select current template's pdfTemplateId, or the default one
          const current = template.pdfTemplateId;
          if (current && templates.some((t) => t.id === current)) {
            setSelectedPdfTemplateId(current);
          } else {
            const def = templates.find((t) => t.isDefault);
            setSelectedPdfTemplateId(def?.id ?? null);
          }
        }
      } finally {
        setLoadingPdfTemplates(false);
      }
    }
  };

  const confirmPublish = async () => {
    if (!template) return;
    setTemplate({ ...template, isPublished: true, pdfTemplateId: selectedPdfTemplateId });
    setShowPublishModal(false);
    await fetch(`/api/inspection-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: true, pdfTemplateId: selectedPdfTemplateId }),
    });
  };

  const createPdfTemplate = async () => {
    const name = newPdfTemplateName.trim();
    if (!name) return;
    setCreatingPdfTemplate(true);
    try {
      const res = await fetch("/api/pdf-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const created: PdfTemplate = await res.json();
        setPdfTemplates((prev) => [...prev, created]);
        setSelectedPdfTemplateId(created.id);
        setNewPdfTemplateName("");
      }
    } finally {
      setCreatingPdfTemplate(false);
    }
  };

  const toggleScoring = async () => {
    if (!template) return;
    const next = !template.scoringEnabled;
    setTemplate({ ...template, scoringEnabled: next });
    await fetch(`/api/inspection-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoringEnabled: next }),
    });
  };

  // ── Sections ───────────────────────────────────────────────────
  const addSection = async (pageNumber?: number) => {
    if (!template) return;
    const pos = (template.sections.at(-1)?.position ?? 0) + 1;
    const page = pageNumber ?? (template.sections.at(-1)?.pageNumber ?? 1);
    const res = await fetch(`/api/inspection-templates/${id}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Section", position: pos, pageNumber: page }),
    });
    if (!res.ok) return;
    const section = await res.json();
    setTemplate((prev) => prev ? { ...prev, sections: [...prev.sections, section] } : prev);
    setActiveSectionId(section.id);
  };

  const addPage = async () => {
    if (!template) return;
    const maxPage = Math.max(...template.sections.map((s) => s.pageNumber ?? 1), 0);
    await addSection(maxPage + 1);
  };

  const updateSectionTitle = async (sectionId: string, title: string) => {
    setTemplate((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) => s.id === sectionId ? { ...s, title } : s),
    } : prev);
    await fetch(`/api/inspection-templates/${id}/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  };

  const updateSectionSettings = async (sectionId: string, updates: Partial<TemplateSection>) => {
    setTemplate((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) => s.id === sectionId ? { ...s, ...updates } : s),
    } : prev);
    await fetch(`/api/inspection-templates/${id}/sections/${sectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
  };

  const deleteSection = async (sectionId: string) => {
    if (!template || template.sections.length <= 1) return;
    if (!confirm("Delete this section and all its questions?")) return;
    await fetch(`/api/inspection-templates/${id}/sections/${sectionId}`, { method: "DELETE" });
    setTemplate((prev) => {
      if (!prev) return prev;
      const remaining = prev.sections.filter((s) => s.id !== sectionId);
      if (activeSectionId === sectionId) setActiveSectionId(remaining[0]?.id ?? null);
      return { ...prev, sections: remaining };
    });
  };

  const moveSection = async (sectionId: string, dir: "up" | "down") => {
    if (!template) return;
    const idx = template.sections.findIndex((s) => s.id === sectionId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= template.sections.length) return;
    const sections = [...template.sections];
    const posA = sections[idx].position;
    const posB = sections[swapIdx].position;
    sections[idx] = { ...sections[idx], position: posB };
    sections[swapIdx] = { ...sections[swapIdx], position: posA };
    sections.sort((a, b) => a.position - b.position);
    setTemplate((prev) => prev ? { ...prev, sections } : prev);
    await Promise.all([
      fetch(`/api/inspection-templates/${id}/sections/${sections[idx < swapIdx ? swapIdx : idx].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: posA }),
      }),
      fetch(`/api/inspection-templates/${id}/sections/${sections[idx < swapIdx ? idx : swapIdx].id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: posB }),
      }),
    ]);
  };

  // ── Questions ──────────────────────────────────────────────────
  const addQuestion = async (sectionId: string) => {
    if (!template) return;
    const section = template.sections.find((s) => s.id === sectionId);
    if (!section) return;
    // Auto-number: "Question N" based on how many questions the section already has
    const nextNum = section.questions.length + 1;
    const title = `Question ${nextNum}`;
    const pos = (section.questions.at(-1)?.position ?? 0) + 1;
    const res = await fetch(`/api/inspection-templates/${id}/sections/${sectionId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "yes_no_na", title, position: pos }),
    });
    if (!res.ok) return;
    const q = await res.json();
    setTemplate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId ? { ...s, questions: [...s.questions, q] } : s
        ),
      };
    });
    // Auto-select the newly created question
    setSelectedQuestionId(q.id);
  };

  // updateQuestion: uses functional setState + no template in deps — fixes stale closure bug
  const updateQuestion = useCallback(
    async (questionId: string, updates: Partial<TemplateQuestion>) => {
      setTemplate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) => ({
            ...s,
            questions: s.questions.map((q) => q.id === questionId ? { ...q, ...updates } : q),
          })),
        };
      });
      await fetch(`/api/inspection-templates/${id}/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
    },
    [id]  // No template dep — functional update reads latest state automatically
  );

  const deleteQuestion = async (questionId: string, sectionId: string) => {
    await fetch(`/api/inspection-templates/${id}/questions/${questionId}`, { method: "DELETE" });
    setTemplate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sections: prev.sections.map((s) =>
          s.id === sectionId
            ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) }
            : s
        ),
      };
    });
  };

  const moveQuestion = async (questionId: string, sectionId: string, dir: "up" | "down") => {
    if (!template) return;
    const section = template.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const idx = section.questions.findIndex((q) => q.id === questionId);
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= section.questions.length) return;
    const qs = [...section.questions];
    const posA = qs[idx].position;
    const posB = qs[swapIdx].position;
    qs[idx] = { ...qs[idx], position: posB };
    qs[swapIdx] = { ...qs[swapIdx], position: posA };
    qs.sort((a, b) => a.position - b.position);
    setTemplate((prev) => prev ? {
      ...prev,
      sections: prev.sections.map((s) => s.id === sectionId ? { ...s, questions: qs } : s),
    } : prev);
    await Promise.all([
      fetch(`/api/inspection-templates/${id}/questions/${qs[idx < swapIdx ? swapIdx : idx].id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: posA }),
      }),
      fetch(`/api/inspection-templates/${id}/questions/${qs[idx < swapIdx ? idx : swapIdx].id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: posB }),
      }),
    ]);
  };

  const duplicateQuestion = async (question: TemplateQuestion, sectionId: string) => {
    if (!template) return;
    const section = template.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const pos = (section.questions.at(-1)?.position ?? 0) + 1;
    const res = await fetch(`/api/inspection-templates/${id}/sections/${sectionId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: question.type,
        title: `${question.title} (copy)`,
        description: question.description,
        required: question.required,
        scoring: question.scoring,
        weight: question.weight,
        options: question.options,
        position: pos,
        conditionalRules: question.conditionalRules,
        flagRules: question.flagRules,
      }),
    });
    if (res.ok) {
      const q = await res.json();
      setTemplate((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((s) =>
            s.id === sectionId ? { ...s, questions: [...s.questions, q] } : s
          ),
        };
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
      </div>
    );
  }
  if (!template) return null;

  const activeSection = template.sections.find((s) => s.id === activeSectionId) ?? template.sections[0];
  const totalQuestions = template.sections.reduce((sum, s) => sum + s.questions.length, 0);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard/inspections" className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </Link>
        <div className="flex-1 min-w-0">
          <input
            value={titleValue}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="text-base font-semibold text-gray-900 bg-transparent border-0 outline-none w-full"
            placeholder="Template title…"
          />
          <input
            value={descValue}
            onChange={(e) => handleDescChange(e.target.value)}
            className="text-xs text-gray-600 bg-transparent border-0 outline-none w-full mt-0.5"
            placeholder="Description (optional)…"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">{totalQuestions} question{totalQuestions !== 1 ? "s" : ""}</span>
          {template.boardName && (
            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-medium">{template.boardName}</span>
          )}
          {saving && <span className="text-xs text-gray-600">Saving…</span>}
          {/* Scoring toggle */}
          <button
            onClick={toggleScoring}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              template.scoringEnabled
                ? "bg-purple-50 border-purple-200 text-purple-700"
                : "border-gray-200 text-gray-500 hover:bg-gray-50"
            }`}
          >
            <Settings2 className="h-3.5 w-3.5" />
            {template.scoringEnabled ? "Scoring on" : "Scoring off"}
          </button>
          {/* Publish toggle */}
          <button
            onClick={togglePublish}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              template.isPublished
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-white text-gray-900 hover:bg-gray-100"
            }`}
          >
            {template.isPublished ? (
              <><Eye className="h-3.5 w-3.5" /> Published</>
            ) : (
              <><EyeOff className="h-3.5 w-3.5" /> Draft</>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Pages & Sections hierarchy */}
        <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-600">Pages & Sections</span>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {(() => {
              const pages = Array.from(new Set(template.sections.map((s) => s.pageNumber ?? 1))).sort((a, b) => a - b);
              return pages.map((pageNum) => {
                const pageSections = template.sections.filter((s) => (s.pageNumber ?? 1) === pageNum);
                return (
                  <div key={`page-${pageNum}`} className="space-y-0.5 mb-1">
                    {/* Page header */}
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-600 bg-gray-50">
                      Page {pageNum}
                    </div>
                    {/* Sections in this page */}
                    {pageSections.map((section, sIdx) => (
                      <div
                        key={section.id}
                        className={`group mx-2 rounded-md transition-colors ${
                          activeSectionId === section.id
                            ? "bg-blue-50 border-l-2 border-blue-600"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        {/* Main section row */}
                        <div
                          className="px-3 py-2 cursor-pointer"
                          onClick={() => setActiveSectionId(section.id)}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <GripVertical className="h-3.5 w-3.5 text-gray-700 flex-shrink-0 opacity-0 group-hover:opacity-100" />
                            <span className={`text-[13px] font-medium truncate ${activeSectionId === section.id ? "text-blue-700 font-semibold" : "text-gray-700"}`}>
                              {section.title}
                            </span>
                            <span className="text-[10px] text-gray-600 ml-auto">{section.questions.length}q</span>
                          </div>
                          {/* Repeatable & Signoff indicators */}
                          <div className="flex items-center gap-2 ml-7 text-[11px]">
                            <label
                              className="flex items-center gap-1 cursor-pointer hover:text-orange-600 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={!!section.isRepeatable}
                                onChange={(e) => updateSectionSettings(section.id, { isRepeatable: e.target.checked })}
                                className="h-3 w-3 rounded accent-orange-500"
                              />
                              <Repeat className="h-3 w-3 text-orange-600" />
                              <span className="text-gray-600">Repeat</span>
                            </label>
                            <label
                              className="flex items-center gap-1 cursor-pointer hover:text-green-600 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={!!section.requiresSignoff}
                                onChange={(e) => updateSectionSettings(section.id, { requiresSignoff: e.target.checked })}
                                className="h-3 w-3 rounded accent-green-600"
                              />
                              <ShieldCheck className="h-3 w-3 text-green-500" />
                              <span className="text-gray-600">Signoff</span>
                            </label>
                          </div>
                        </div>
                        {/* Action buttons (on hover) */}
                        <div className="hidden group-hover:flex items-center gap-0.5 px-3 pb-2 mt-1 border-t border-gray-100 pt-1.5">
                          <button
                            className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"
                            onClick={(e) => { e.stopPropagation(); moveSection(section.id, "up"); }}
                            disabled={sIdx === 0}
                            title="Move up"
                          >
                            <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                          </button>
                          <button
                            className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30"
                            onClick={(e) => { e.stopPropagation(); moveSection(section.id, "down"); }}
                            disabled={sIdx === pageSections.length - 1}
                            title="Move down"
                          >
                            <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                          </button>
                          <button
                            className="p-0.5 rounded hover:bg-red-100 disabled:opacity-30"
                            onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
                            disabled={template.sections.length <= 1}
                            title="Delete section"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-gray-600 hover:text-red-500" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              });
            })()}
          </div>
          <div className="p-3 border-t border-gray-100 space-y-2">
            <button
              onClick={addPage}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-green-600 hover:text-green-700 hover:bg-green-50 rounded-md transition-colors font-medium"
            >
              <Plus className="h-3.5 w-3.5" />
              Add page
            </button>
            <button
              onClick={() => addSection()}
              className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add section
            </button>
          </div>
        </div>

        {/* Main: Questions editor with split view */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeSection ? (
            <>
              {/* Section header */}
              <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
                <div className="mb-3">
                  <input
                    value={activeSection.title}
                    onChange={(e) => updateSectionTitle(activeSection.id, e.target.value)}
                    className="text-xl font-bold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-200 focus:border-blue-400 outline-none w-full py-1"
                    placeholder="Section title…"
                  />
                </div>

                {/* Section settings bar */}
                <div className="flex flex-wrap items-center gap-3 text-xs bg-gray-50 -mx-6 -mb-4 px-6 py-2 border-t border-gray-100">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!activeSection.isRepeatable}
                      onChange={(e) => updateSectionSettings(activeSection.id, { isRepeatable: e.target.checked })}
                      className="h-3.5 w-3.5 rounded accent-orange-500"
                    />
                    <Repeat className="h-3.5 w-3.5 text-orange-600" />
                    <span className="text-gray-600">Repeatable</span>
                  </label>
                  {activeSection.isRepeatable && (
                    <div className="flex items-center gap-1">
                      <span className="text-gray-600">Max:</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={activeSection.maxRepetitions ?? ""}
                        onChange={(e) => updateSectionSettings(activeSection.id, { maxRepetitions: e.target.value ? parseInt(e.target.value) : null })}
                        className="w-12 border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-400 text-center"
                        placeholder="∞"
                      />
                    </div>
                  )}
                  <div className="w-px h-4 bg-gray-300" />
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!activeSection.requiresSignoff}
                      onChange={(e) => updateSectionSettings(activeSection.id, { requiresSignoff: e.target.checked })}
                      className="h-3.5 w-3.5 rounded accent-green-600"
                    />
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-gray-600">Requires sign-off</span>
                  </label>
                  {activeSection.requiresSignoff && (
                    <input
                      value={(activeSection.signoffRoles ?? []).join(", ")}
                      onChange={(e) => updateSectionSettings(activeSection.id, { signoffRoles: e.target.value.split(",").map(r => r.trim()).filter(Boolean) })}
                      className="border border-gray-200 rounded px-2 py-0.5 outline-none focus:border-blue-400 w-40"
                      placeholder="e.g. operator, qc_tech"
                    />
                  )}
                  <div className="w-px h-4 bg-gray-300" />
                  <div className="flex items-center gap-1">
                    <span className="text-gray-600">Page:</span>
                    <input
                      type="number"
                      min={1}
                      value={activeSection.pageNumber ?? 1}
                      onChange={(e) => updateSectionSettings(activeSection.id, { pageNumber: parseInt(e.target.value) || 1 })}
                      className="w-10 border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-400 text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Questions list & editor split view */}
              <div className="flex-1 flex overflow-hidden">
                {/* Left: Questions list */}
                <div className="w-80 flex-shrink-0 bg-gray-50 border-r border-gray-200 overflow-y-auto p-4 space-y-2">
                  {activeSection.questions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-600 text-sm gap-2">
                      <ClipboardList className="h-8 w-8 text-gray-900" />
                      <p>No questions yet</p>
                      <p className="text-[11px] text-gray-700">Click &quot;Add question&quot; below</p>
                    </div>
                  ) : (
                    activeSection.questions.map((question, qIdx) => {
                      const typeInfo = QUESTION_TYPES.find((t) => t.value === question.type);
                      const isSelected = selectedQuestionId === question.id;
                      return (
                        <div
                          key={question.id}
                          className={`group relative rounded-lg border-2 transition-all cursor-pointer ${
                            isSelected
                              ? "border-blue-500 bg-white shadow-md"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                          }`}
                          onClick={() => setSelectedQuestionId(question.id)}
                        >
                          <div className="p-3">
                            <div className="flex items-start gap-2 mb-1.5">
                              <div className={cn("flex-shrink-0 mt-0.5", isSelected ? "text-blue-600" : "text-gray-600")}>{typeInfo?.icon}</div>
                              <div className="flex-1 min-w-0">
                                <p className={cn("text-[13px] font-semibold truncate", isSelected ? "text-blue-700" : "text-gray-900")}>{question.title || "Untitled"}</p>
                                <p className="text-[11px] text-gray-600 mt-0.5">{typeInfo?.label}</p>
                              </div>
                              <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0", isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500")}>{qIdx + 1}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {question.required && (
                                <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded-full">Required</span>
                              )}
                              {question.scoring && (
                                <span className="text-[10px] bg-purple-50 text-purple-600 border border-purple-100 px-1.5 py-0.5 rounded-full">Scored</span>
                              )}
                              {(question.conditionalRules?.length ?? 0) > 0 && (
                                <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full">Conditional</span>
                              )}
                            </div>
                          </div>
                          {/* Hover action bar */}
                          <div
                            className="hidden group-hover:flex items-center gap-0.5 px-2 pb-1.5 border-t border-gray-100 pt-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                              onClick={() => moveQuestion(question.id, activeSection.id, "up")}
                              disabled={qIdx === 0}
                              title="Move up"
                            >
                              <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                              onClick={() => moveQuestion(question.id, activeSection.id, "down")}
                              disabled={qIdx === activeSection.questions.length - 1}
                              title="Move down"
                            >
                              <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-gray-100 ml-auto"
                              onClick={() => duplicateQuestion(question, activeSection.id)}
                              title="Duplicate"
                            >
                              <Copy className="h-3.5 w-3.5 text-gray-600" />
                            </button>
                            <button
                              className="p-1 rounded hover:bg-red-50"
                              onClick={() => {
                                deleteQuestion(question.id, activeSection.id);
                                if (selectedQuestionId === question.id) setSelectedQuestionId(null);
                              }}
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-gray-600 hover:text-red-500" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <button
                    onClick={() => {
                      addQuestion(activeSection.id);
                    }}
                    className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 text-sm text-blue-600 border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add question
                  </button>
                </div>

                {/* Right: Question editor */}
                <div className="flex-1 overflow-y-auto bg-white p-6">
                  {selectedQuestionId ? (
                    (() => {
                      const question = activeSection.questions.find((q) => q.id === selectedQuestionId);
                      if (!question) return null;
                      const qIdx = activeSection.questions.findIndex((q) => q.id === selectedQuestionId);
                      return (
                        <QuestionEditor
                          key={question.id}
                          question={question}
                          qIdx={qIdx}
                          totalInSection={activeSection.questions.length}
                          scoringEnabled={template.scoringEnabled}
                          allQuestions={template.sections.flatMap((s) => s.questions)}
                          onUpdate={(updates) => updateQuestion(question.id, updates)}
                          onDelete={() => {
                            deleteQuestion(question.id, activeSection.id);
                            setSelectedQuestionId(null);
                          }}
                          onMove={(dir) => moveQuestion(question.id, activeSection.id, dir)}
                          onDuplicate={() => duplicateQuestion(question, activeSection.id)}
                          showTypeModal={showTypeModal === question.id}
                          setShowTypeModal={(show) => setShowTypeModal(show ? question.id : null)}
                        />
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600">
                      <ClipboardList className="h-12 w-12 mb-3 text-gray-700" />
                      <p className="text-sm">Select a question to edit</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
              <p className="text-sm">Add a section to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Publish + Choose PDF Template Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Publish Template</h3>
                <p className="text-xs text-gray-500 mt-0.5">Choose a PDF template for exports</p>
              </div>
              <button onClick={() => setShowPublishModal(false)} className="p-1.5 rounded-md hover:bg-gray-100">
                <X className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            <div className="px-6 py-4 max-h-80 overflow-y-auto">
              {loadingPdfTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Default (no template) option */}
                  <label
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedPdfTemplateId === null
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="pdfTemplate"
                      checked={selectedPdfTemplateId === null}
                      onChange={() => setSelectedPdfTemplateId(null)}
                      className="accent-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">Default Template</p>
                      <p className="text-xs text-gray-500">Standard inspection report layout</p>
                    </div>
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-medium">BUILT-IN</span>
                  </label>

                  {pdfTemplates.map((pt) => (
                    <label
                      key={pt.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedPdfTemplateId === pt.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      )}
                    >
                      <input
                        type="radio"
                        name="pdfTemplate"
                        checked={selectedPdfTemplateId === pt.id}
                        onChange={() => setSelectedPdfTemplateId(pt.id)}
                        className="accent-blue-600"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{pt.name}</p>
                        {pt.description && <p className="text-xs text-gray-500 truncate">{pt.description}</p>}
                      </div>
                      {pt.isDefault && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">DEFAULT</span>
                      )}
                    </label>
                  ))}

                  {/* Create new template inline */}
                  <div className="pt-2 border-t border-gray-100 mt-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 mb-2">Create New PDF Template</p>
                    <div className="flex gap-2">
                      <input
                        value={newPdfTemplateName}
                        onChange={(e) => setNewPdfTemplateName(e.target.value)}
                        placeholder="Template name…"
                        className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                        onKeyDown={(e) => e.key === "Enter" && createPdfTemplate()}
                      />
                      <button
                        onClick={createPdfTemplate}
                        disabled={!newPdfTemplateName.trim() || creatingPdfTemplate}
                        className="px-3 py-1.5 text-xs font-medium bg-white text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
                      >
                        {creatingPdfTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <Link
                      href="/dashboard/inspections/pdf-templates"
                      className="text-xs text-blue-600 hover:text-blue-700 mt-2 inline-block"
                    >
                      Manage PDF Templates →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-100 flex justify-end gap-2 bg-gray-50">
              <button
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmPublish}
                className="px-4 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Question Editor Component ───────────────────────────────────────
function QuestionEditor({
  question,
  qIdx,
  totalInSection,
  scoringEnabled,
  allQuestions,
  onUpdate,
  onDelete,
  onMove,
  onDuplicate,
  showTypeModal,
  setShowTypeModal,
}: {
  question: TemplateQuestion;
  qIdx: number;
  totalInSection: number;
  scoringEnabled: boolean;
  allQuestions: TemplateQuestion[];
  onUpdate: (updates: Partial<TemplateQuestion>) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
  onDuplicate: () => void;
  showTypeModal: boolean;
  setShowTypeModal: (show: boolean) => void;
}) {
  const [titleVal, setTitleVal] = useState(question.title);
  const [descVal, setDescVal] = useState(question.description || "");
  const [showDesc, setShowDesc] = useState(!!question.description);
  const [showConditions, setShowConditions] = useState(!!question.conditionalRules?.length);
  const [showInstructions, setShowInstructions] = useState(!!(question.instructions?.text || question.instructions?.mediaUrl));
  const [instrText, setInstrText] = useState(question.instructions?.text || "");
  const [instrMediaUrl, setInstrMediaUrl] = useState(question.instructions?.mediaUrl || "");
  const [instrMediaType, setInstrMediaType] = useState<"image" | "video" | "">(question.instructions?.mediaType || "");
  const [instrUploading, setInstrUploading] = useState(false);
  const instrFileRef = useRef<HTMLInputElement>(null);

  // Always keep a ref to the latest onUpdate so debounced callbacks never go stale
  const onUpdateRef = useRef(onUpdate);
  useEffect(() => { onUpdateRef.current = onUpdate; }, [onUpdate]);

  // Debounced savers — created once, always call the latest onUpdate via ref
  const saveTitle = useRef(debounce((v: string) => onUpdateRef.current({ title: v }), 500));
  const saveDesc = useRef(debounce((v: string) => onUpdateRef.current({ description: v || null }), 500));
  const saveInstructions = useRef(debounce((text: string, mediaUrl: string, mediaType: "image" | "video" | "") => {
    if (!text && !mediaUrl) {
      onUpdateRef.current({ instructions: null });
    } else {
      onUpdateRef.current({ instructions: { text, mediaUrl, mediaType } });
    }
  }, 500));

  const typeInfo = QUESTION_TYPES.find((t) => t.value === question.type);
  const hasOptions = ["dropdown", "multiple_choice", "multiple_selection"].includes(question.type);

  const addOption = () => {
    const opts = [...(question.options || []), { id: String(Date.now()), text: "" }];
    onUpdate({ options: opts });
  };
  const updateOption = (optId: string, field: string, value: string | number | boolean) => {
    const opts = question.options.map((o) => o.id === optId ? { ...o, [field]: value } : o);
    onUpdate({ options: opts });
  };
  const deleteOption = (optId: string) => {
    onUpdate({ options: question.options.filter((o) => o.id !== optId) });
  };

  // Conditional logic
  const addCondition = () => {
    const rules: ConditionalRule[] = [...(question.conditionalRules ?? []), {
      condition: { questionId: "", operator: "equals", value: "" },
      action: { type: "show" },
    }];
    onUpdate({ conditionalRules: rules });
    setShowConditions(true);
  };
  const updateCondition = (idx: number, rule: ConditionalRule) => {
    const rules = [...(question.conditionalRules ?? [])];
    rules[idx] = rule;
    onUpdate({ conditionalRules: rules });
  };
  const removeCondition = (idx: number) => {
    const rules = (question.conditionalRules ?? []).filter((_, i) => i !== idx);
    onUpdate({ conditionalRules: rules });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-1">
          <button className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30" onClick={() => onMove("up")} disabled={qIdx === 0}>
            <ChevronUp className="h-3.5 w-3.5 text-gray-600" />
          </button>
          <button className="p-0.5 hover:bg-gray-100 rounded disabled:opacity-30" onClick={() => onMove("down")} disabled={qIdx === totalInSection - 1}>
            <ChevronDown className="h-3.5 w-3.5 text-gray-600" />
          </button>
        </div>

        {/* Type selector */}
        <button
          onClick={() => setShowTypeModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-medium text-gray-700 transition-colors"
        >
          {typeInfo?.icon}
          {typeInfo?.label}
        </button>
        
        {/* Type selection modal */}
        {showTypeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
            <div className="bg-white rounded-xl shadow-2xl ring-1 ring-gray-200 w-96 max-h-96 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Select Question Type</h3>
                <button
                  onClick={() => setShowTypeModal(false)}
                  className="p-1 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                {QUESTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    className={`w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors ${
                      question.type === t.value ? "bg-blue-50 border-l-2 border-l-blue-600" : ""
                    }`}
                    onClick={() => {
                      onUpdate({ type: t.value });
                      setShowTypeModal(false);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 text-gray-600 mt-0.5">{t.icon}</div>
                      <div>
                        <div className={`text-sm font-medium ${question.type === t.value ? "text-blue-700" : "text-gray-900"}`}>
                          {t.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 ml-auto">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) => onUpdate({ required: e.target.checked })}
              className="h-3.5 w-3.5 rounded accent-blue-600"
            />
            <span className="text-xs text-gray-500">Required</span>
          </label>

          {scoringEnabled && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={question.scoring}
                onChange={(e) => onUpdate({ scoring: e.target.checked })}
                className="h-3.5 w-3.5 rounded accent-purple-600"
              />
              <span className="text-xs text-gray-500">Scored</span>
            </label>
          )}

          <button
            className="text-xs text-gray-600 hover:text-gray-600 transition-colors"
            onClick={() => setShowDesc(!showDesc)}
          >
            {showDesc ? "Hide hint" : "Add hint"}
          </button>

          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className={cn("p-1 rounded transition-colors", showInstructions || question.instructions?.text || question.instructions?.mediaUrl ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-gray-600")}
            title="Instructions / Information"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={() => setShowConditions(!showConditions)}
            className={cn("p-1 rounded transition-colors", showConditions || question.conditionalRules?.length ? "bg-purple-100 text-purple-600" : "hover:bg-gray-100 text-gray-600")}
            title="Conditional logic"
          >
            <GitBranch className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onDuplicate}
            className="p-1 rounded hover:bg-gray-100 text-gray-600 transition-colors"
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5 text-gray-600 hover:text-red-500" />
          </button>
        </div>
      </div>

      {/* Question title */}
      <div className="px-4 pt-3 pb-2">
        <textarea
          value={titleVal}
          rows={2}
          onChange={(e) => {
            setTitleVal(e.target.value);
            saveTitle.current(e.target.value);
          }}
          className="w-full text-[13px] text-gray-900 font-medium bg-transparent outline-none resize-none placeholder:text-gray-700 leading-snug"
          placeholder="Question title…"
        />
        {showDesc && (
          <input
            value={descVal}
            onChange={(e) => {
              setDescVal(e.target.value);
              saveDesc.current(e.target.value);
            }}
            className="w-full text-xs text-gray-500 bg-transparent outline-none mt-1 placeholder:text-gray-700"
            placeholder="Hint or description (shown to inspector)…"
          />
        )}
      </div>

      {/* Instructions / Information panel */}
      {showInstructions && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">Instructions / Information</span>
          </div>
          <div className="space-y-2.5">
            <div>
              <label className="block text-[10px] font-medium text-gray-500 mb-1">Written Instructions</label>
              <textarea
                value={instrText}
                onChange={(e) => {
                  setInstrText(e.target.value);
                  saveInstructions.current(e.target.value, instrMediaUrl, instrMediaType);
                }}
                rows={3}
                className="w-full text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 resize-y bg-white"
                placeholder="Add instructions, safety notes, procedures…"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Image / Video URL</label>
                <div className="flex gap-1.5">
                  <input
                    value={instrMediaUrl}
                    onChange={(e) => {
                      setInstrMediaUrl(e.target.value);
                      // Auto-detect media type
                      const url = e.target.value.toLowerCase();
                      let type: "image" | "video" | "" = "";
                      if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)) type = "image";
                      else if (url.match(/\.(mp4|webm|ogg)(\?|$)/i) || url.includes("youtube.com") || url.includes("youtu.be") || url.includes("vimeo.com")) type = "video";
                      setInstrMediaType(type);
                      saveInstructions.current(instrText, e.target.value, type);
                    }}
                    className="flex-1 text-xs text-gray-700 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400 bg-white"
                    placeholder="Paste URL or upload a file →"
                  />
                  <button
                    type="button"
                    disabled={instrUploading}
                    onClick={() => instrFileRef.current?.click()}
                    className="flex items-center gap-1 px-2.5 py-2 text-[11px] font-medium border border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-500 transition-colors whitespace-nowrap disabled:opacity-50"
                  >
                    {instrUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                    {instrUploading ? "Uploading…" : "Upload"}
                  </button>
                  <input
                    ref={instrFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,video/mp4,video/webm"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setInstrUploading(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch("/api/upload", { method: "POST", body: fd });
                        if (res.ok) {
                          const data = await res.json();
                          const url = data.url as string;
                          setInstrMediaUrl(url);
                          const type: "image" | "video" | "" = file.type.startsWith("video/") ? "video" : file.type.startsWith("image/") ? "image" : "";
                          setInstrMediaType(type);
                          saveInstructions.current(instrText, url, type);
                        }
                      } catch { /* ignore */ }
                      setInstrUploading(false);
                      if (instrFileRef.current) instrFileRef.current.value = "";
                    }}
                  />
                </div>
              </div>
              <div className="w-24">
                <label className="block text-[10px] font-medium text-gray-500 mb-1">Type</label>
                <select
                  value={instrMediaType}
                  onChange={(e) => {
                    const mt = e.target.value as "image" | "video" | "";
                    setInstrMediaType(mt);
                    saveInstructions.current(instrText, instrMediaUrl, mt);
                  }}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-2 outline-none focus:border-blue-400 bg-white"
                >
                  <option value="">Auto</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
              </div>
            </div>
            {instrMediaUrl && instrMediaType === "image" && (
              <div className="rounded-lg border border-gray-200 overflow-hidden bg-gray-50 p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={instrMediaUrl} alt="Instruction" className="max-h-32 mx-auto rounded" onError={(e) => (e.currentTarget.style.display = "none")} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Options editor for dropdown/multiple_choice/multiple_selection */}
      {hasOptions && (
        <div className="px-4 pb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Options</div>
          <div className="space-y-1.5">
            {question.options.map((opt) => (
              <div key={opt.id} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border-2 border-gray-300 flex-shrink-0" />
                <input
                  value={opt.text}
                  onChange={(e) => updateOption(opt.id, "text", e.target.value)}
                  className="flex-1 text-xs text-gray-700 border-b border-gray-200 hover:border-gray-400 focus:border-blue-400 outline-none py-0.5 bg-transparent"
                  placeholder="Option text…"
                />
                {scoringEnabled && question.scoring && (
                  <input
                    type="number"
                    value={opt.score ?? ""}
                    onChange={(e) => updateOption(opt.id, "score", e.target.value === "" ? 0 : parseFloat(e.target.value))}
                    className="w-14 text-xs border border-gray-200 rounded px-1 py-0.5 outline-none focus:border-purple-400 text-center"
                    placeholder="pts"
                    title="Score"
                  />
                )}
                {scoringEnabled && question.scoring && (
                  <label className="flex items-center gap-0.5 cursor-pointer" title="Auto-flag">
                    <input
                      type="checkbox"
                      checked={!!opt.flagged}
                      onChange={(e) => updateOption(opt.id, "flagged", e.target.checked)}
                      className="h-3 w-3 rounded accent-red-500"
                    />
                    <span className="text-[10px] text-gray-600">Flag</span>
                  </label>
                )}
                <button onClick={() => deleteOption(opt.id)} className="p-0.5 hover:bg-red-50 rounded">
                  <Trash2 className="h-3 w-3 text-gray-700 hover:text-red-500" />
                </button>
              </div>
            ))}
            <button
              onClick={addOption}
              className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2"
            >
              <Plus className="h-3 w-3" />
              Add option
            </button>
          </div>
        </div>
      )}

      {/* Table column config */}
      {question.type === "table" && (
        <TableColumnConfig
          options={question.options}
          onUpdate={(opts) => onUpdate({ options: opts })}
        />
      )}

      {/* Conditional logic rules */}
      {showConditions && (
        <div className="px-4 pb-3 border-t border-gray-100 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-purple-500">Conditional Logic</span>
            <button onClick={addCondition} className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1">
              <Plus className="h-3 w-3" /> Add rule
            </button>
          </div>
          {(question.conditionalRules ?? []).map((rule, rIdx) => (
            <div key={rIdx} className="flex items-center gap-2 mb-2 bg-purple-50 rounded-lg p-2">
              <select
                value={rule.condition.questionId}
                onChange={(e) => updateCondition(rIdx, { ...rule, condition: { ...rule.condition, questionId: e.target.value } })}
                className="text-xs border border-gray-200 rounded px-1.5 py-1 outline-none flex-1 bg-white"
              >
                <option value="">Source question…</option>
                {allQuestions.filter(q => q.id !== question.id).map(q => (
                  <option key={q.id} value={q.id}>{q.title.substring(0, 40)}</option>
                ))}
              </select>
              <select
                value={rule.condition.operator}
                onChange={(e) => updateCondition(rIdx, { ...rule, condition: { ...rule.condition, operator: e.target.value as ConditionalRule["condition"]["operator"] } })}
                className="text-xs border border-gray-200 rounded px-1.5 py-1 outline-none bg-white w-20"
              >
                <option value="equals">equals</option>
                <option value="not_equals">not equals</option>
                <option value="contains">contains</option>
                <option value="greater_than">{">"}</option>
                <option value="less_than">{"<"}</option>
              </select>
              <input
                value={String(rule.condition.value ?? "")}
                onChange={(e) => updateCondition(rIdx, { ...rule, condition: { ...rule.condition, value: e.target.value } })}
                className="text-xs border border-gray-200 rounded px-1.5 py-1 outline-none w-20 bg-white"
                placeholder="Value"
              />
              <span className="text-[10px] text-gray-600">→</span>
              <select
                value={rule.action.type}
                onChange={(e) => updateCondition(rIdx, { ...rule, action: { ...rule.action, type: e.target.value as ConditionalRule["action"]["type"] } })}
                className="text-xs border border-gray-200 rounded px-1.5 py-1 outline-none bg-white w-24"
              >
                <option value="show">Show</option>
                <option value="hide">Hide</option>
                <option value="require_note">Require note</option>
                <option value="require_media">Require media</option>
                <option value="notify">Notify</option>
              </select>
              <button onClick={() => removeCondition(rIdx)} className="p-0.5 rounded hover:bg-red-100">
                <Trash2 className="h-3 w-3 text-red-600" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Weight (only for scored questions) */}
      {scoringEnabled && question.scoring && (
        <div className="px-4 pb-3 flex items-center gap-2">
          <span className="text-xs text-gray-600">Weight:</span>
          <input
            type="number"
            min={0.1}
            step={0.1}
            value={question.weight}
            onChange={(e) => onUpdate({ weight: parseFloat(e.target.value) || 1 })}
            className="w-16 text-xs border border-gray-200 rounded px-1.5 py-0.5 outline-none focus:border-blue-400 text-center"
          />
        </div>
      )}
    </div>
  );
}

// ── Table column config ──────────────────────────────────────────
function TableColumnConfig({ options, onUpdate }: {
  options: { id: string; text: string; score?: number; flagged?: boolean }[];
  onUpdate: (opts: typeof options) => void;
}) {
  // We reuse the options array to store table column definitions: {id, text: columnName, score: 0 means text type, 1 for number, 2 for date}
  const cols = options ?? [];
  const addCol = () => onUpdate([...cols, { id: String(Date.now()), text: "" }]);
  const updateCol = (id: string, text: string) => onUpdate(cols.map(c => c.id === id ? { ...c, text } : c));
  const removeCol = (id: string) => onUpdate(cols.filter(c => c.id !== id));

  return (
    <div className="px-4 pb-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 mb-1.5">Table Columns</div>
      <div className="space-y-1.5">
        {cols.map((col) => (
          <div key={col.id} className="flex items-center gap-2">
            <Table className="h-3 w-3 text-gray-700 flex-shrink-0" />
            <input
              value={col.text}
              onChange={(e) => updateCol(col.id, e.target.value)}
              className="flex-1 text-xs text-gray-700 border-b border-gray-200 hover:border-gray-400 focus:border-blue-400 outline-none py-0.5 bg-transparent"
              placeholder="Column name…"
            />
            <button onClick={() => removeCol(col.id)} className="p-0.5 hover:bg-red-50 rounded">
              <Trash2 className="h-3 w-3 text-gray-700 hover:text-red-500" />
            </button>
          </div>
        ))}
        <button onClick={addCol} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 mt-2">
          <Plus className="h-3 w-3" /> Add column
        </button>
      </div>
    </div>
  );
}
