"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Flag,
  MessageSquarePlus,
  ChevronRight,
  Send,
  AlertTriangle,
  ClipboardList,
  Plus,
  X,
  Check,
  Star,
  StickyNote,
  Repeat,
  ShieldCheck,
  Trash2,
  PenLine,
  Camera,
  Download,
  Settings2,
  GripVertical,
  FileText,
  Pencil,
  ChevronDown,
} from "lucide-react";
import type { Inspection, TemplateSection, TemplateQuestion, InspectionResponse, InspectionAction, InspectionSignature, TableColumnDef, QuestionType, PdfTemplate } from "@/lib/types";
import { shouldShowQuestion, shouldAutoFlag } from "@/lib/conditional-logic";

type FullInspection = Inspection & {
  templateSnapshot: { sections: TemplateSection[] };
  responses: InspectionResponse[];
  actions: InspectionAction[];
  signatures?: InspectionSignature[];
};

// Response map key: `${questionId}_${repeatIndex}` so each repeat has its own entry
function responseKey(questionId: string, repeatIndex: number) {
  return `${questionId}_${repeatIndex}`;
}

export default function InspectionPage() {
  const { id } = useParams<{ id: string }>();
  const [inspection, setInspection] = useState<FullInspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showAddActionModal, setShowAddActionModal] = useState<{ questionId: string; repeatIndex: number } | null>(null);
  // responses keyed by `${questionId}_${repeatIndex}`
  const [responses, setResponses] = useState<Record<string, InspectionResponse>>({});
  // how many instances each section has (sectionId → count); default 1
  const [sectionRepeatCounts, setSectionRepeatCounts] = useState<Record<string, number>>({});
  // editing-mode: lets user add/edit/delete sections & questions on this inspection's snapshot
  const [editMode, setEditMode] = useState(false);
  const [savingSnapshot, setSavingSnapshot] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inspections/${id}`);
    if (res.ok) {
      const data: FullInspection = await res.json();
      setInspection(data);
      const map: Record<string, InspectionResponse> = {};
      const repeatMaxBySec: Record<string, number> = {};
      for (const r of data.responses) {
        map[responseKey(r.questionId, r.repeatIndex ?? 0)] = r;
        // Track max repeatIndex seen per section so we restore the right count
        const rIdx = r.repeatIndex ?? 0;
        if ((repeatMaxBySec[r.sectionId] ?? 0) < rIdx) {
          repeatMaxBySec[r.sectionId] = rIdx;
        }
      }
      setResponses(map);
      // Convert max repeatIndex → count (max 0 → 1 instance, max 2 → 3 instances)
      const counts: Record<string, number> = {};
      for (const [secId, maxIdx] of Object.entries(repeatMaxBySec)) {
        counts[secId] = maxIdx + 1;
      }
      setSectionRepeatCounts(counts);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const saveResponse = useCallback(async (
    questionId: string,
    sectionId: string,
    updates: Partial<InspectionResponse>,
    repeatIndex = 0
  ) => {
    const key = responseKey(questionId, repeatIndex);
    const body = { questionId, sectionId, repeatIndex, ...updates };
    setResponses((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...body },
    }));
    await fetch(`/api/inspections/${id}/responses`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }, [id]);

  const addRepeat = useCallback((sectionId: string, maxRepetitions: number | null) => {
    setSectionRepeatCounts((prev) => {
      const current = prev[sectionId] ?? 1;
      if (maxRepetitions !== null && current >= maxRepetitions) return prev;
      return { ...prev, [sectionId]: current + 1 };
    });
  }, []);

  const removeRepeat = useCallback(async (sectionId: string, repeatIndex: number) => {
    // Remove all responses for this sectionId + repeatIndex from local state
    setResponses((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        if (next[key].sectionId === sectionId && (next[key].repeatIndex ?? 0) === repeatIndex) {
          delete next[key];
        }
      }
      return next;
    });
    setSectionRepeatCounts((prev) => ({
      ...prev,
      [sectionId]: Math.max(1, (prev[sectionId] ?? 1) - 1),
    }));
    // TODO: could also DELETE responses from DB for that repeatIndex
  }, []);

  // ── Snapshot editing helpers (inspection-level template customization) ──
  const persistSnapshot = useCallback(async (newSections: TemplateSection[]) => {
    if (!inspection) return;
    setSavingSnapshot(true);
    const updatedSnapshot = { ...inspection.templateSnapshot, sections: newSections };
    setInspection((prev) => prev ? { ...prev, templateSnapshot: updatedSnapshot } : prev);
    await fetch(`/api/inspections/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateSnapshot: updatedSnapshot }),
    });
    setSavingSnapshot(false);
  }, [inspection, id]);

  const addSection = useCallback(() => {
    if (!inspection) return;
    const sections = inspection.templateSnapshot?.sections ?? [];
    const newSec: TemplateSection = {
      id: crypto.randomUUID(),
      templateId: inspection.templateId ?? "",
      title: `New Section ${sections.length + 1}`,
      position: sections.length,
      pageNumber: 1,
      isRepeatable: false,
      maxRepetitions: null,
      requiresSignoff: false,
      signoffRoles: null,
      questions: [],
    };
    persistSnapshot([...sections, newSec]);
    setActiveSectionIdx(sections.length);
  }, [inspection, persistSnapshot, setActiveSectionIdx]);

  const updateSectionTitle = useCallback((sectionId: string, title: string) => {
    if (!inspection) return;
    const sections = (inspection.templateSnapshot?.sections ?? []).map((s) =>
      s.id === sectionId ? { ...s, title } : s
    );
    persistSnapshot(sections);
  }, [inspection, persistSnapshot]);

  const deleteSection = useCallback((sectionId: string) => {
    if (!inspection) return;
    const sections = (inspection.templateSnapshot?.sections ?? []).filter((s) => s.id !== sectionId);
    persistSnapshot(sections);
    setActiveSectionIdx((idx) => Math.min(idx, Math.max(0, sections.length - 1)));
  }, [inspection, persistSnapshot, setActiveSectionIdx]);

  const addQuestion = useCallback((sectionId: string) => {
    if (!inspection) return;
    const sections = (inspection.templateSnapshot?.sections ?? []).map((s) => {
      if (s.id !== sectionId) return s;
      const newQ: TemplateQuestion = {
        id: crypto.randomUUID(),
        sectionId,
        title: "",
        description: null,
        type: "yes_no_na",
        required: false,
        scoring: false,
        weight: 1,
        options: [],
        position: s.questions.length,
        conditionalRules: null,
        flagRules: null,
        linkedQuestionId: null,
        instructions: null,
      };
      return { ...s, questions: [...s.questions, newQ] };
    });
    persistSnapshot(sections);
  }, [inspection, persistSnapshot]);

  const updateQuestion = useCallback((sectionId: string, questionId: string, updates: Partial<TemplateQuestion>) => {
    if (!inspection) return;
    const sections = (inspection.templateSnapshot?.sections ?? []).map((s) => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        questions: s.questions.map((q) => q.id === questionId ? { ...q, ...updates } : q),
      };
    });
    persistSnapshot(sections);
  }, [inspection, persistSnapshot]);

  const deleteQuestion = useCallback((sectionId: string, questionId: string) => {
    if (!inspection) return;
    const sections = (inspection.templateSnapshot?.sections ?? []).map((s) => {
      if (s.id !== sectionId) return s;
      return { ...s, questions: s.questions.filter((q) => q.id !== questionId) };
    });
    persistSnapshot(sections);
  }, [inspection, persistSnapshot]);

  const submitInspection = async () => {
    if (!inspection) return;

    // Check required questions across all sections and all repeat instances
    const sections = inspection.templateSnapshot?.sections ?? [];
    const unansweredRequired: string[] = [];
    for (const sec of sections) {
      const count = sectionRepeatCounts[sec.id] ?? 1;
      for (let ri = 0; ri < count; ri++) {
        for (const q of sec.questions) {
          if (!q.required) continue;
          const v = responses[responseKey(q.id, ri)]?.value;
          const isEmpty = v === undefined || v === "" || v === null || (typeof v === "string" && v.trim() === "");
          if (isEmpty) {
            const label = count > 1 ? `${q.title || "Untitled"} (instance ${ri + 1})` : (q.title || "Untitled question");
            unansweredRequired.push(label);
          }
        }
      }
    }

    if (unansweredRequired.length > 0) {
      const list = unansweredRequired.slice(0, 5).map((t) => `• ${t}`).join("\n");
      const more = unansweredRequired.length > 5 ? `\n…and ${unansweredRequired.length - 5} more` : "";
      if (!confirm(`${unansweredRequired.length} required question(s) are unanswered:\n\n${list}${more}\n\nSubmit anyway?`)) return;
    } else {
      if (!confirm("Submit and complete this inspection? This cannot be undone.")) return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/inspections/${id}/submit`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setInspection((prev) => prev ? { ...prev, status: "completed", score: data.score, completedAt: data.completedAt } : prev);
    }
    setSubmitting(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  );

  if (!inspection) return (
    <div className="flex flex-col items-center justify-center h-full text-gray-500">
      <ClipboardList className="h-10 w-10 text-gray-300 mb-2" />
      <p>Inspection not found.</p>
      <Link href="/dashboard/inspections" className="mt-3 text-sm text-blue-600 hover:underline">← Back to Inspections</Link>
    </div>
  );

  const sections = inspection.templateSnapshot?.sections ?? [];
  const isCompleted = inspection.status === "completed";

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4">
        <Link href="/dashboard/inspections" className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-semibold text-gray-900 truncate">{inspection.title}</h1>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {inspection.site && <span>{inspection.site}</span>}
            {inspection.site && <span>·</span>}
            <span>{new Date(inspection.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
            {isCompleted && <span>·</span>}
            {isCompleted && <span className="text-green-600 font-medium">Completed</span>}
          </div>
        </div>
        {!isCompleted && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditMode((v) => !v)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors",
                editMode
                  ? "bg-purple-50 text-purple-700 border-purple-200"
                  : "text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100"
              )}
            >
              <Settings2 className="h-4 w-4" />
              {editMode ? "Done Editing" : "Customize"}
              {savingSnapshot && <Loader2 className="h-3 w-3 animate-spin" />}
            </button>
            <a
              href={`/api/inspections/${id}/pdf`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
            >
              <Download className="h-4 w-4" />
              PDF
            </a>
            <button
              onClick={submitInspection}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit
            </button>
          </div>
        )}
        {isCompleted && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </div>
            <PdfExportButton inspectionId={id} />
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar – sections */}
        <div className="w-56 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto">
          {isCompleted && inspection.score !== null && (
            <ScoreWidget score={inspection.score} />
          )}
          <div className="px-3 py-2 pt-4">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-1">Sections</p>
            {sections.map((sec, idx) => {
              const repeatCount = sectionRepeatCounts[sec.id] ?? 1;
              // Count answered across all repeat instances
              let answered = 0;
              const total = sec.questions.length * repeatCount;
              for (let ri = 0; ri < repeatCount; ri++) {
                for (const q of sec.questions) {
                  const v = responses[responseKey(q.id, ri)]?.value;
                  if (v !== undefined && v !== "") answered++;
                }
              }
              const isComplete = total > 0 && answered === total;
              const isActive = activeSectionIdx === idx;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSectionIdx(idx)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors",
                    isActive ? "bg-blue-50 border border-blue-200" : "text-gray-600 hover:bg-gray-100 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      isComplete ? "bg-green-500" : answered > 0 ? "bg-blue-400" : "bg-gray-200"
                    )} />
                    <span className={cn("text-sm font-medium truncate flex-1", isActive ? "text-blue-700" : "text-gray-700")}>{sec.title}</span>
                    {sec.isRepeatable && repeatCount > 1 && (
                      <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">×{repeatCount}</span>
                    )}
                    {isComplete && <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />}
                  </div>
                  <div className="mt-1.5 ml-4">
                    <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", isComplete ? "bg-green-400" : "bg-blue-400")}
                        style={{ width: total > 0 ? `${Math.round((answered / total) * 100)}%` : "0%" }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">{answered}/{total}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {isCompleted ? (
            <ReportView inspection={inspection} responses={responses} sections={sections} />
          ) : (
            <ConductView
              inspection={inspection}
              sections={sections}
              activeSectionIdx={activeSectionIdx}
              setActiveSectionIdx={setActiveSectionIdx}
              responses={responses}
              sectionRepeatCounts={sectionRepeatCounts}
              onSave={saveResponse}
              onAddRepeat={addRepeat}
              onRemoveRepeat={removeRepeat}
              onAddAction={(qId, ri) => setShowAddActionModal({ questionId: qId, repeatIndex: ri })}
            />
          )}
        </div>
      </div>

      {showAddActionModal && (
        <AddActionModal
          inspectionId={id}
          questionId={showAddActionModal.questionId}
          onClose={() => setShowAddActionModal(null)}
          onAdded={load}
        />
      )}
    </div>
  );
}

// ── Score widget ────────────────────────────────────────────────────
function ScoreWidget({ score }: { score: number }) {
  const isPass = score >= 80;
  const isMid = score >= 50;
  const color = isPass ? "#16a34a" : isMid ? "#d97706" : "#dc2626";
  const bg = isPass ? "bg-green-50" : isMid ? "bg-yellow-50" : "bg-red-50";
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className={`${bg} px-4 py-4 border-b border-gray-200 flex flex-col items-center`}>
      <svg width="72" height="72" viewBox="0 0 72 72" className="mb-1">
        <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="7" />
        <circle
          cx="36" cy="36" r={r} fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
        />
        <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>
          {score}%
        </text>
      </svg>
      <p className="text-xs font-semibold" style={{ color }}>
        {isPass ? "Pass" : isMid ? "Needs Improvement" : "Fail"}
      </p>
    </div>
  );
}

// ── Conduct view ────────────────────────────────────────────────────
function ConductView({
  inspection,
  sections,
  activeSectionIdx,
  setActiveSectionIdx,
  responses,
  sectionRepeatCounts,
  onSave,
  onAddRepeat,
  onRemoveRepeat,
  onAddAction,
}: {
  inspection: FullInspection;
  sections: TemplateSection[];
  activeSectionIdx: number;
  setActiveSectionIdx: (i: number) => void;
  responses: Record<string, InspectionResponse>;
  sectionRepeatCounts: Record<string, number>;
  onSave: (questionId: string, sectionId: string, updates: Partial<InspectionResponse>, repeatIndex?: number) => void;
  onAddRepeat: (sectionId: string, maxRepetitions: number | null) => void;
  onRemoveRepeat: (sectionId: string, repeatIndex: number) => void;
  onAddAction: (qId: string, repeatIndex: number) => void;
}) {
  const section = sections[activeSectionIdx];
  if (!section) return <div className="p-8 text-gray-400">No sections found.</div>;

  const repeatCount = sectionRepeatCounts[section.id] ?? 1;
  const maxReps = section.maxRepetitions;
  const canAddMore = section.isRepeatable && (maxReps === null || repeatCount < maxReps);

  // Overall progress across all repeat instances
  const allResponseValues = useMemo(() =>
    Object.fromEntries(Object.entries(responses).map(([key, r]) => [key, { value: r.value }])),
    [responses]
  );

  // Count answered across all instances (using repeatIndex-aware key)
  const totalQuestionsAcrossInstances = section.questions.length * repeatCount;
  let totalAnswered = 0;
  for (let ri = 0; ri < repeatCount; ri++) {
    for (const q of section.questions) {
      const v = responses[responseKey(q.id, ri)]?.value;
      if (v !== undefined && v !== "") totalAnswered++;
    }
  }
  const pct = totalQuestionsAcrossInstances > 0 ? Math.round((totalAnswered / totalQuestionsAcrossInstances) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      {/* Section header with overall progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">{section.title}</h2>
            {section.isRepeatable && (
              <span className="flex items-center gap-1 text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                <Repeat className="h-3 w-3" /> Repeatable
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400 font-medium">{totalAnswered}/{totalQuestionsAcrossInstances} answered</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              pct === 100 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : "bg-blue-400"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Render each repeat instance */}
      <div className="space-y-6">
        {Array.from({ length: repeatCount }, (_, ri) => (
          <RepeatInstance
            key={ri}
            repeatIndex={ri}
            repeatCount={repeatCount}
            section={section}
            inspection={inspection}
            responses={responses}
            allResponseValues={allResponseValues}
            onSave={onSave}
            onRemoveRepeat={onRemoveRepeat}
            onAddAction={onAddAction}
          />
        ))}
      </div>

      {/* Add another instance button */}
      {section.isRepeatable && (
        <div className="mt-6">
          {canAddMore ? (
            <button
              onClick={() => onAddRepeat(section.id, maxReps)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-orange-300 text-orange-600 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-colors font-medium text-sm"
            >
              <Plus className="h-4 w-4" />
              Add another {section.title}
              {maxReps !== null && (
                <span className="text-xs text-orange-400 font-normal ml-1">({repeatCount}/{maxReps} max)</span>
              )}
            </button>
          ) : maxReps !== null ? (
            <div className="text-center text-xs text-gray-400 py-2">
              Maximum {maxReps} instance{maxReps !== 1 ? "s" : ""} reached
            </div>
          ) : null}
        </div>
      )}

      {/* Section nav */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-100">
        <button
          disabled={activeSectionIdx === 0}
          onClick={() => setActiveSectionIdx(activeSectionIdx - 1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4" /> Previous
        </button>
        <span className="text-xs text-gray-400">{activeSectionIdx + 1} of {sections.length}</span>
        <button
          disabled={activeSectionIdx === sections.length - 1}
          onClick={() => setActiveSectionIdx(activeSectionIdx + 1)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Next <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── A single repeat instance of a section ───────────────────────────
function RepeatInstance({
  repeatIndex,
  repeatCount,
  section,
  inspection,
  responses,
  allResponseValues,
  onSave,
  onRemoveRepeat,
  onAddAction,
}: {
  repeatIndex: number;
  repeatCount: number;
  section: TemplateSection;
  inspection: FullInspection;
  responses: Record<string, InspectionResponse>;
  allResponseValues: Record<string, { value: unknown }>;
  onSave: (questionId: string, sectionId: string, updates: Partial<InspectionResponse>, repeatIndex?: number) => void;
  onRemoveRepeat: (sectionId: string, repeatIndex: number) => void;
  onAddAction: (qId: string, repeatIndex: number) => void;
}) {
  // Build per-instance response values for conditional logic
  // (use the repeat-index-aware keys but remap to plain questionId for the logic fn)
  const instanceResponseValues = useMemo(() => {
    const map: Record<string, { value: unknown }> = {};
    for (const q of section.questions) {
      const key = responseKey(q.id, repeatIndex);
      map[q.id] = { value: allResponseValues[key]?.value };
    }
    return map;
  }, [section.questions, allResponseValues, repeatIndex]);

  const visibleQuestions = useMemo(() =>
    section.questions.filter((q) => shouldShowQuestion(q.conditionalRules, instanceResponseValues)),
    [section.questions, instanceResponseValues]
  );

  const answeredInInstance = visibleQuestions.filter((q) => {
    const v = responses[responseKey(q.id, repeatIndex)]?.value;
    return v !== undefined && v !== "";
  }).length;

  return (
    <div className={cn(
      "rounded-xl border-2 overflow-hidden",
      repeatCount > 1 ? "border-orange-200" : "border-transparent"
    )}>
      {/* Instance header — only shown when there are multiple */}
      {repeatCount > 1 && (
        <div className="flex items-center justify-between bg-orange-50 px-4 py-2 border-b border-orange-200">
          <div className="flex items-center gap-2">
            <Repeat className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-sm font-semibold text-orange-700">
              {section.title} — Instance {repeatIndex + 1}
            </span>
            <span className="text-xs text-orange-400">({answeredInInstance}/{visibleQuestions.length} answered)</span>
          </div>
          {repeatIndex > 0 && (
            <button
              onClick={() => onRemoveRepeat(section.id, repeatIndex)}
              className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors"
              title="Remove this instance"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </button>
          )}
        </div>
      )}

      {/* Questions */}
      <div className={cn("space-y-4", repeatCount > 1 ? "p-4 bg-orange-50/20" : "")}>
        {visibleQuestions.map((q) => (
          <QuestionCard
            key={`${q.id}_${repeatIndex}`}
            question={q}
            sectionId={section.id}
            repeatIndex={repeatIndex}
            response={responses[responseKey(q.id, repeatIndex)]}
            onSave={onSave}
            onAddAction={onAddAction}
            actions={inspection.actions.filter((a) => a.questionId === q.id)}
          />
        ))}
        {visibleQuestions.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            All questions are hidden by conditional logic.
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionCard({
  question: q,
  sectionId,
  repeatIndex = 0,
  response,
  onSave,
  onAddAction,
  actions,
}: {
  question: TemplateQuestion;
  sectionId: string;
  repeatIndex?: number;
  response?: InspectionResponse;
  onSave: (questionId: string, sectionId: string, updates: Partial<InspectionResponse>, repeatIndex?: number) => void;
  onAddAction: (qId: string, repeatIndex: number) => void;
  actions: InspectionAction[];
}) {
  const [showNote, setShowNote] = useState(!!response?.note);
  const [note, setNote] = useState(response?.note ?? "");
  const noteSaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleNote = (val: string) => {
    setNote(val);
    if (noteSaveRef.current) clearTimeout(noteSaveRef.current);
    noteSaveRef.current = setTimeout(() => {
      onSave(q.id, sectionId, { note: val }, repeatIndex);
    }, 700);
  };

  const isFlagged = !!response?.flagged;
  const hasInstructions = !!(q.instructions?.text || q.instructions?.mediaUrl);
  const [showInstr, setShowInstr] = useState(false);

  return (
    <div className={cn(
      "bg-white rounded-xl border border-gray-200 p-4 transition-colors",
      isFlagged && "border-red-200 bg-red-50/30"
    )}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <span className="text-[14px] font-medium text-gray-900">{q.title}</span>
          {q.required && <span className="ml-1 text-red-500 text-sm">*</span>}
          {q.description && <p className="text-xs text-gray-400 mt-0.5">{q.description}</p>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {hasInstructions && (
            <button
              onClick={() => setShowInstr(!showInstr)}
              className={cn("p-1.5 rounded-md transition-colors", showInstr ? "bg-blue-100 text-blue-600" : "hover:bg-gray-100 text-blue-400")}
              title="View instructions"
            >
              <FileText className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => onSave(q.id, sectionId, { flagged: !isFlagged }, repeatIndex)}
            className={cn("p-1.5 rounded-md transition-colors", isFlagged ? "bg-red-100 text-red-600" : "hover:bg-gray-100 text-gray-400")}
            title={isFlagged ? "Remove flag" : "Flag this item"}
          >
            <Flag className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setShowNote((v) => !v)}
            className={cn("p-1.5 rounded-md transition-colors", showNote ? "bg-yellow-100 text-yellow-600" : "hover:bg-gray-100 text-gray-400")}
            title="Add note"
          >
            <StickyNote className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onAddAction(q.id, repeatIndex)}
            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 transition-colors"
            title="Add action"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Instructions panel */}
      {showInstr && hasInstructions && (
        <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <FileText className="h-3.5 w-3.5" />
            Instructions
          </div>
          {q.instructions?.text && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{q.instructions.text}</p>
          )}
          {q.instructions?.mediaUrl && q.instructions.mediaType === "image" && (
            <div className="rounded-lg overflow-hidden border border-blue-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={q.instructions.mediaUrl} alt="Instruction" className="max-h-60 mx-auto" />
            </div>
          )}
          {q.instructions?.mediaUrl && q.instructions.mediaType === "video" && (
            q.instructions.mediaUrl.includes("youtube.com") || q.instructions.mediaUrl.includes("youtu.be") ? (
              <div className="aspect-video rounded-lg overflow-hidden border border-blue-100">
                <iframe
                  src={q.instructions.mediaUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  className="w-full h-full"
                  allowFullScreen
                  title="Instruction video"
                />
              </div>
            ) : (
              <video src={q.instructions.mediaUrl} controls className="max-h-60 rounded-lg border border-blue-100 mx-auto" />
            )
          )}
        </div>
      )}

      {/* Response widget */}
      <ResponseWidget question={q} sectionId={sectionId} repeatIndex={repeatIndex} response={response} onSave={onSave} />

      {showNote && (
        <textarea
          value={note}
          onChange={(e) => handleNote(e.target.value)}
          rows={2}
          placeholder="Add a note…"
          className="mt-3 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-none text-gray-700"
        />
      )}

      {actions.length > 0 && (
        <div className="mt-3 space-y-1">
          {actions.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-xs bg-orange-50 border border-orange-200 rounded-md px-2 py-1">
              <AlertTriangle className="h-3 w-3 text-orange-500 flex-shrink-0" />
              <span className="flex-1 text-orange-700">{a.title}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                a.status === "open" ? "bg-red-100 text-red-600" : a.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
              )}>{a.status.replace("_", " ")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResponseWidget({ question: q, sectionId, repeatIndex = 0, response, onSave }: {
  question: TemplateQuestion;
  sectionId: string;
  repeatIndex?: number;
  response?: InspectionResponse;
  onSave: (questionId: string, sectionId: string, updates: Partial<InspectionResponse>, repeatIndex?: number) => void;
}) {
  const val = (response?.value as string) ?? "";
  const save = (v: string) => onSave(q.id, sectionId, { value: v }, repeatIndex);
  const saveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [localText, setLocalText] = useState(val);

  // Sync local text when response changes externally (e.g. on load)
  useEffect(() => { setLocalText((response?.value as string) ?? ""); }, [response?.value]);

  const saveText = (v: string) => {
    setLocalText(v);
    if (saveRef.current) clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => save(v), 600);
  };

  if (q.type === "yes_no_na") {
    const options = [
      { v: "yes", label: "Yes", icon: CheckCircle2, active: "bg-green-100 text-green-700 border-green-300", hover: "hover:bg-green-50" },
      { v: "no", label: "No", icon: XCircle, active: "bg-red-100 text-red-700 border-red-300", hover: "hover:bg-red-50" },
      { v: "na", label: "N/A", icon: MinusCircle, active: "bg-gray-100 text-gray-600 border-gray-300", hover: "hover:bg-gray-50" },
    ];
    return (
      <div className="flex gap-2">
        {options.map(({ v, label, icon: Icon, active, hover }) => (
          <button
            key={v}
            onClick={() => save(val === v ? "" : v)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
              val === v ? active : `border-gray-200 text-gray-600 ${hover}`
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === "text") {
    return (
      <textarea
        value={localText}
        rows={3}
        onChange={(e) => saveText(e.target.value)}
        placeholder="Enter response…"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    );
  }

  if (q.type === "long_text") {
    return (
      <textarea
        value={localText}
        rows={5}
        onChange={(e) => saveText(e.target.value)}
        placeholder="Enter detailed response…"
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
    );
  }

  if (q.type === "number") {
    return (
      <input
        type="number"
        value={localText}
        onChange={(e) => saveText(e.target.value)}
        placeholder="Enter number…"
        className="w-48 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  if (q.type === "checkbox") {
    return (
      <button
        onClick={() => save(val === "checked" ? "" : "checked")}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
          val === "checked" ? "bg-blue-100 text-blue-700 border-blue-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"
        )}
      >
        <div className={cn("w-4 h-4 rounded border-2 flex items-center justify-center transition-colors", val === "checked" ? "bg-blue-600 border-blue-600" : "border-gray-300")}>
          {val === "checked" && <Check className="h-2.5 w-2.5 text-white" />}
        </div>
        {val === "checked" ? "Checked" : "Not checked"}
      </button>
    );
  }

  if (q.type === "date") {
    return (
      <input
        type="date"
        value={localText}
        onChange={(e) => save(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
      />
    );
  }

  if (q.type === "rating") {
    const rating = parseInt(val) || 0;
    return (
      <div className="flex gap-1 items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => save(val === String(star) ? "" : String(star))}
            className="transition-transform hover:scale-110"
          >
            <Star className={cn("h-7 w-7", star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-200 hover:text-yellow-200")} />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-xs text-gray-400">{rating}/5</span>
        )}
      </div>
    );
  }

  if (q.type === "dropdown") {
    const opts = q.options ?? [];
    return (
      <select
        value={val}
        onChange={(e) => save(e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        <option value="">Select…</option>
        {opts.map((o) => <option key={o.id} value={o.text}>{o.text}</option>)}
      </select>
    );
  }

  if (q.type === "multiple_choice") {
    const opts = q.options ?? [];
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => (
          <button
            key={o.id}
            onClick={() => save(val === o.text ? "" : o.text)}
            className={cn(
              "px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
              val === o.text ? "bg-blue-100 text-blue-700 border-blue-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
          >
            {o.text}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === "multiple_selection") {
    const opts = q.options ?? [];
    const selected: string[] = (() => {
      try { return JSON.parse(val || "[]"); } catch { return []; }
    })();
    const toggle = (text: string) => {
      const next = selected.includes(text) ? selected.filter((s) => s !== text) : [...selected, text];
      save(JSON.stringify(next));
    };
    return (
      <div className="flex flex-wrap gap-2">
        {opts.map((o) => {
          const isOn = selected.includes(o.text);
          return (
            <button
              key={o.id}
              onClick={() => toggle(o.text)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-colors",
                isOn ? "bg-blue-100 text-blue-700 border-blue-300" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
            >
              <div className={cn("w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0", isOn ? "bg-blue-600 border-blue-600" : "border-gray-300")}>
                {isOn && <Check className="h-2 w-2 text-white" />}
              </div>
              {o.text}
            </button>
          );
        })}
      </div>
    );
  }

  if (q.type === "photo") {
    const hasPhoto = val && val.startsWith("data:");
    return (
      <div className="space-y-2">
        {hasPhoto ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={val} alt="Attached photo" className="max-h-40 rounded-lg border border-gray-200 object-cover" />
            <button
              onClick={() => save("")}
              className="absolute top-1 right-1 p-1 bg-white/80 rounded-full hover:bg-red-50 border border-gray-200"
              title="Remove photo"
            >
              <X className="h-3 w-3 text-gray-500" />
            </button>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg p-6 cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors">
            <Camera className="h-8 w-8 text-gray-300" />
            <span className="text-sm text-gray-400">Click to attach a photo</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => save(reader.result as string);
                reader.readAsDataURL(file);
              }}
            />
          </label>
        )}
      </div>
    );
  }

  if (q.type === "signature") {
    return <SignatureWidget value={val} onSave={save} />;
  }

  // Auto-populated types — read-only info display
  if (["site_name", "asset_name", "company_name", "document_number"].includes(q.type)) {
    const labels: Record<string, string> = {
      site_name: "Auto-populated from inspection site",
      asset_name: "Auto-populated from linked asset",
      company_name: "Auto-populated from company",
      document_number: "Auto-generated document number",
    };
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-500 italic">
        <PenLine className="h-3.5 w-3.5 flex-shrink-0" />
        {val || labels[q.type]}
      </div>
    );
  }

  // Table question
  if (q.type === "table") {
    return <TableWidget question={q} value={val} onSave={save} />;
  }

  return <p className="text-xs text-gray-400">Unsupported question type: {q.type}</p>;
}

// ── Signature Widget (canvas-based with timestamp) ──────────────────
function SignatureWidget({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<import("signature_pad").default | null>(null);
  const [signed, setSigned] = useState(false);

  // Parse stored value: { signature: base64, signedAt: iso, name?: string }
  const parsed = useMemo(() => {
    if (!value) return null;
    try {
      const obj = JSON.parse(value);
      if (obj && obj.signature) return obj as { signature: string; signedAt: string; name?: string };
    } catch {
      // Legacy plain-text value — treat as name
      if (value.trim()) return { signature: "", signedAt: "", name: value };
    }
    return null;
  }, [value]);

  useEffect(() => {
    if (parsed?.signature) return; // Don't init pad if already signed
    const canvas = canvasRef.current;
    if (!canvas) return;
    import("signature_pad").then(({ default: SignaturePad }) => {
      const pad = new SignaturePad(canvas, {
        backgroundColor: "rgb(255,255,255)",
        penColor: "#1e293b",
      });
      padRef.current = pad;
      const resize = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext("2d")?.scale(ratio, ratio);
        pad.clear();
      };
      resize();
      pad.addEventListener("endStroke", () => setSigned(!pad.isEmpty()));
    });
    return () => { padRef.current?.off(); };
  }, [parsed?.signature]);

  const handleClear = () => {
    padRef.current?.clear();
    setSigned(false);
  };

  const handleAccept = () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) return;
    const data = pad.toDataURL("image/png");
    const payload = JSON.stringify({
      signature: data,
      signedAt: new Date().toISOString(),
    });
    onSave(payload);
  };

  const handleReset = () => {
    onSave("");
    setSigned(false);
  };

  // Show completed signature
  if (parsed?.signature) {
    return (
      <div className="space-y-2">
        <div className="border border-green-200 rounded-lg p-3 bg-green-50/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={parsed.signature} alt="Signature" className="max-h-24 mx-auto" />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Signed on{" "}
            <span className="font-medium text-gray-700">
              {new Date(parsed.signedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </p>
          <button
            onClick={handleReset}
            className="text-xs text-red-500 hover:text-red-700 hover:underline"
          >
            Clear & re-sign
          </button>
        </div>
      </div>
    );
  }

  // Show legacy text-only signature
  if (parsed?.name && !parsed.signature) {
    return (
      <div className="space-y-2">
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 text-center">
          <p className="font-serif italic text-lg text-gray-700">{parsed.name}</p>
          <p className="text-xs text-gray-400 mt-1">(Legacy text signature)</p>
        </div>
        <button onClick={handleReset} className="text-xs text-red-500 hover:text-red-700 hover:underline">
          Clear & draw new signature
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white relative">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: 120, touchAction: "none" }}
        />
        {!signed && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm text-gray-300">Sign here</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={handleClear}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          Clear
        </button>
        <button
          onClick={handleAccept}
          disabled={!signed}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
        >
          <Check className="h-3 w-3" />
          Accept Signature
        </button>
      </div>
    </div>
  );
}

// ── Table Widget (editable grid) ─────────────────────────────────────
function TableWidget({ question: q, value, onSave }: { question: TemplateQuestion; value: string; onSave: (v: string) => void }) {
  // Columns stored in options: {id, text: columnName, score: 0=text,1=number,2=date}
  const columns = useMemo(() => {
    const opts = q.options ?? [];
    return opts.map((o) => ({
      id: o.id,
      name: o.text || "Column",
      type: o.score === 1 ? "number" : o.score === 2 ? "date" : "text",
    }));
  }, [q.options]);

  // Rows stored as JSON array of objects [{colId: value, ...}, ...]
  const [rows, setRows] = useState<Record<string, string>[]>(() => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [{}];
    } catch {
      return [{}];
    }
  });

  const saveRows = useCallback((newRows: Record<string, string>[]) => {
    setRows(newRows);
    onSave(JSON.stringify(newRows));
  }, [onSave]);

  const updateCell = (rowIdx: number, colId: string, cellValue: string) => {
    const next = rows.map((r, i) => i === rowIdx ? { ...r, [colId]: cellValue } : r);
    saveRows(next);
  };

  const addRow = () => saveRows([...rows, {}]);
  const removeRow = (rowIdx: number) => {
    if (rows.length <= 1) return;
    saveRows(rows.filter((_, i) => i !== rowIdx));
  };

  if (columns.length === 0) {
    return <p className="text-xs text-gray-400 italic">No table columns defined in template.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th key={col.id} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  {col.name}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50/50">
                {columns.map((col) => (
                  <td key={col.id} className="px-2 py-1">
                    <input
                      type={col.type === "number" ? "number" : col.type === "date" ? "date" : "text"}
                      value={row[col.id] ?? ""}
                      onChange={(e) => updateCell(ri, col.id, e.target.value)}
                      className="w-full text-sm border border-transparent hover:border-gray-200 focus:border-blue-400 rounded px-1.5 py-1 outline-none bg-transparent"
                      placeholder="—"
                    />
                  </td>
                ))}
                <td className="px-1 py-1">
                  {rows.length > 1 && (
                    <button
                      onClick={() => removeRow(ri)}
                      className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 transition-colors"
      >
        <Plus className="h-3 w-3" />
        Add row
      </button>
    </div>
  );
}

// ── Report view ─────────────────────────────────────────────────────
function ReportView({ inspection, responses, sections }: {
  inspection: FullInspection;
  responses: Record<string, InspectionResponse>;
  sections: TemplateSection[];
}) {
  const score = inspection.score;
  const flaggedItems = Object.values(responses).filter((r) => r.flagged);
  const actions = inspection.actions;
  const openActions = actions.filter((a) => a.status === "open" || a.status === "in_progress");

  return (
    <div className="max-w-3xl mx-auto px-6 py-6">
      {/* Score header */}
      {score !== null && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex items-center gap-6">
          <ScoreWidget score={score} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Inspection Report</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Completed {inspection.completedAt
                ? new Date(inspection.completedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                : ""}
            </p>
            <div className="flex gap-3 mt-3 text-sm">
              <span className="text-gray-500">{sections.reduce((s, sec) => s + sec.questions.length, 0)} questions</span>
              {flaggedItems.length > 0 && (
                <span className="text-red-500 flex items-center gap-1"><Flag className="h-3 w-3" /> {flaggedItems.length} flagged</span>
              )}
              {openActions.length > 0 && (
                <span className="text-orange-500 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {openActions.length} open actions</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section breakdown */}
      {sections.map((sec) => {
        // Derive how many repeat instances were recorded (max repeatIndex + 1)
        let maxRi = 0;
        for (const r of Object.values(responses)) {
          if (r.sectionId === sec.id && (r.repeatIndex ?? 0) > maxRi) {
            maxRi = r.repeatIndex ?? 0;
          }
        }
        const repeatCount = maxRi + 1;

        return (
          <div key={sec.id} className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{sec.title}</h3>
                {repeatCount > 1 && (
                  <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-medium">×{repeatCount}</span>
                )}
              </div>
            </div>

            {/* Render each repeat instance */}
            {Array.from({ length: repeatCount }, (_, ri) => {
              const yesCount = sec.questions.filter((q) => responses[responseKey(q.id, ri)]?.value === "yes").length;
              const noCount = sec.questions.filter((q) => responses[responseKey(q.id, ri)]?.value === "no").length;
              return (
                <div key={ri} className={cn("mb-4", repeatCount > 1 && "border border-orange-200 rounded-xl overflow-hidden")}>
                  {repeatCount > 1 && (
                    <div className="flex items-center justify-between bg-orange-50 px-3 py-1.5 border-b border-orange-200">
                      <span className="text-xs font-semibold text-orange-700 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" /> Instance {ri + 1}
                      </span>
                      {(yesCount + noCount > 0) && (
                        <span className="text-xs text-gray-400">{yesCount} pass · {noCount} fail</span>
                      )}
                    </div>
                  )}
                  {repeatCount === 1 && (yesCount + noCount > 0) && (
                    <div className="flex justify-end mb-1">
                      <span className="text-xs text-gray-400">{yesCount} pass · {noCount} fail</span>
                    </div>
                  )}
                  <div className={cn("space-y-2", repeatCount > 1 && "p-3 bg-orange-50/20")}>
                    {sec.questions.map((q) => {
                      const r = responses[responseKey(q.id, ri)];
                      const qActions = actions.filter((a) => a.questionId === q.id);
                      return (
                        <div key={q.id} className={cn(
                          "bg-white rounded-lg border px-4 py-3",
                          r?.flagged ? "border-red-200 bg-red-50/20" : "border-gray-200"
                        )}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="text-[13px] font-medium text-gray-800">{q.title}</span>
                              {q.description && <p className="text-xs text-gray-400 mt-0.5">{q.description}</p>}
                            </div>
                            <ResponseBadge type={q.type} value={(r?.value as string) ?? ""} />
                          </div>
                          {r?.note && (
                            <p className="mt-2 text-xs text-gray-500 italic bg-yellow-50 border border-yellow-100 rounded px-2 py-1">
                              Note: {r.note}
                            </p>
                          )}
                          {r?.flagged && (
                            <div className="mt-1.5 flex items-center gap-1 text-xs text-red-500">
                              <Flag className="h-3 w-3" /> Flagged
                            </div>
                          )}
                          {qActions.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {qActions.map((a) => (
                                <div key={a.id} className="flex items-center gap-2 text-xs text-orange-700 bg-orange-50 border border-orange-100 rounded px-2 py-1">
                                  <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                                  <span className="flex-1">{a.title}</span>
                                  <span className={cn(
                                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                                    a.status === "open" ? "bg-red-100 text-red-600" : a.status === "in_progress" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"
                                  )}>{a.status.replace("_", " ")}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
})}
    </div>
  );
}

function ResponseBadge({ type, value }: { type: string; value: string }) {
  if (!value) return <span className="text-xs text-gray-300 italic">—</span>;
  if (type === "yes_no_na") {
    const styles: Record<string, string> = {
      yes: "bg-green-100 text-green-700",
      no: "bg-red-100 text-red-700",
      na: "bg-gray-100 text-gray-500",
    };
    return <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", styles[value as string] ?? "bg-gray-100 text-gray-500")}>{String(value).toUpperCase()}</span>;
  }
  if (type === "rating") {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className={cn("h-3.5 w-3.5", s <= parseInt(value) ? "fill-yellow-400 text-yellow-400" : "text-gray-200")} />
        ))}
      </div>
    );
  }
  if (type === "signature") {
    try {
      const parsed = JSON.parse(value);
      if (parsed?.signature) {
        return (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={parsed.signature} alt="Signature" className="h-8 border border-gray-200 rounded" />
            <span className="text-[10px] text-gray-400">{new Date(parsed.signedAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
        );
      }
    } catch { /* legacy text */ }
    return <span className="text-xs text-gray-700 font-serif italic">{value}</span>;
  }
  if (type === "table") {
    try {
      const rows = JSON.parse(value);
      if (Array.isArray(rows)) return <span className="text-xs text-gray-500">{rows.length} row{rows.length !== 1 ? "s" : ""}</span>;
    } catch { /* ignore */ }
  }
  return <span className="text-xs text-gray-700 max-w-[160px] truncate">{value}</span>;
}

// ── Add Action Modal ────────────────────────────────────────────────
function AddActionModal({ inspectionId, questionId, onClose, onAdded }: {
  inspectionId: string;
  questionId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await fetch(`/api/inspections/${inspectionId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId, title: title.trim(), priority }),
    });
    onAdded();
    onClose();
    setSaving(false);
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Add Action</h2>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-gray-100"><X className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Action description *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the corrective action…"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <div className="flex gap-2">
                {(["low", "medium", "high", "critical"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-sm font-medium border capitalize transition-colors",
                      priority === p
                        ? p === "critical" ? "bg-red-600 text-white border-red-600"
                          : p === "high" ? "bg-red-100 text-red-700 border-red-300"
                          : p === "medium" ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                          : "bg-green-100 text-green-700 border-green-300"
                        : "border-gray-200 text-gray-500 hover:bg-gray-50"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
            <button
              onClick={save}
              disabled={!title.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Add Action
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── PDF Export with template selector ──────────────────────────────
function PdfExportButton({ inspectionId }: { inspectionId: string }) {
  const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (loaded) return;
    fetch("/api/pdf-templates")
      .then(async (r) => {
        if (r.ok) {
          const rows: PdfTemplate[] = await r.json();
          setPdfTemplates(rows);
          const def = rows.find((t) => t.isDefault);
          if (def) setSelectedId(def.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [loaded]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const href = selectedId
    ? `/api/inspections/${inspectionId}/pdf?templateId=${selectedId}`
    : `/api/inspections/${inspectionId}/pdf`;

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center">
        <a
          href={href}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-l-lg border border-blue-200 hover:bg-blue-100 transition-colors"
        >
          <Download className="h-4 w-4" />
          Export PDF
        </a>
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center px-1.5 py-1.5 text-sm text-blue-700 bg-blue-50 rounded-r-lg border border-l-0 border-blue-200 hover:bg-blue-100 transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">PDF Template</p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              onClick={() => { setSelectedId(""); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm transition-colors",
                !selectedId ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
              )}
            >
              Default
            </button>
            {pdfTemplates.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedId(t.id); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2",
                  selectedId === t.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50"
                )}
              >
                <FileText className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">{t.name}</span>
                {t.isDefault && <span className="text-[9px] bg-green-100 text-green-700 px-1 py-0.5 rounded-full font-bold ml-auto flex-shrink-0">DEFAULT</span>}
              </button>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-gray-100">
            <Link
              href="/dashboard/inspections/pdf-templates"
              target="_blank"
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit PDF Templates
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
