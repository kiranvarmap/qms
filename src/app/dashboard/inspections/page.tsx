"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Plus,
  ClipboardList,
  LayoutTemplate,
  ChevronRight,
  Loader2,
  Trash2,
  Play,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  EyeOff,
  BarChart3,
  X,
  Search,
} from "lucide-react";
import type { InspectionTemplate, Inspection } from "@/lib/types";

interface WorkspaceSummary { id: string; name: string; }
interface BoardSummary { id: string; name: string; }
interface BoardItem { id: string; name: string; groupId: string; }

export default function InspectionsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"inspections" | "templates">("inspections");
  const [templates, setTemplates] = useState<InspectionTemplate[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTemplateModal, setShowNewTemplateModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startTemplateId, setStartTemplateId] = useState("");
  const [startTitle, setStartTitle] = useState("");
  const [startSite, setStartSite] = useState("");
  const [starting, setStarting] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [creating, setCreating] = useState(false);

  // Workspace / Board selection for new template
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("");
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(false);

  // Item selection for starting inspection
  const [boardItems, setBoardItems] = useState<BoardItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [tRes, iRes] = await Promise.all([
      fetch("/api/inspection-templates"),
      fetch("/api/inspections"),
    ]);
    if (tRes.ok) setTemplates(await tRes.json());
    if (iRes.ok) setInspections(await iRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]); // eslint-disable-line react-hooks/set-state-in-effect

  // Load workspaces when template modal opens
  useEffect(() => {
    if (!showNewTemplateModal) return;
    fetch("/api/workspaces").then(async (r) => {
      if (r.ok) setWorkspaces(await r.json());
    });
  }, [showNewTemplateModal]);

  // Load boards when workspace changes
  useEffect(() => {
    if (!selectedWorkspaceId) { setBoards([]); setSelectedBoardId(""); return; }
    setLoadingBoards(true);
    setSelectedBoardId("");
    fetch(`/api/workspaces/${selectedWorkspaceId}`).then(async (r) => {
      if (r.ok) {
        const data = await r.json();
        setBoards(data.boards ?? []);
      }
      setLoadingBoards(false);
    });
  }, [selectedWorkspaceId]);

  // Create new template
  const createTemplate = async () => {
    if (!newTemplateName.trim()) return;
    setCreating(true);
    const res = await fetch("/api/inspection-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTemplateName.trim(),
        ...(selectedBoardId && { boardId: selectedBoardId }),
        ...(selectedWorkspaceId && { workspaceId: selectedWorkspaceId }),
      }),
    });
    if (res.ok) {
      const t = await res.json();
      setShowNewTemplateModal(false);
      setNewTemplateName("");
      setSelectedWorkspaceId("");
      setSelectedBoardId("");
      router.push(`/dashboard/inspections/templates/${t.id}`);
    }
    setCreating(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this template? All inspections using it will remain, but new ones cannot be started.")) return;
    await fetch(`/api/inspection-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // Start inspection
  const openStartModal = (templateId: string, templateTitle: string) => {
    setStartTemplateId(templateId);
    setStartTitle(templateTitle);
    setStartSite("");
    setSelectedItemId("");
    setItemSearch("");
    setBoardItems([]);
    setShowStartModal(true);

    // Load items if template is linked to a board
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl?.boardId) {
      setLoadingItems(true);
      fetch(`/api/boards/${tpl.boardId}`).then(async (r) => {
        if (r.ok) {
          const data = await r.json();
          setBoardItems((data.items ?? []).map((i: BoardItem) => ({ id: i.id, name: i.name, groupId: i.groupId })));
        }
        setLoadingItems(false);
      });
    }
  };

  const startInspection = async () => {
    if (!startTitle.trim()) return;
    setStarting(true);
    const res = await fetch("/api/inspections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: startTemplateId,
        title: startTitle.trim(),
        site: startSite,
        ...(selectedItemId && { itemId: selectedItemId }),
      }),
    });
    if (res.ok) {
      const insp = await res.json();
      setShowStartModal(false);
      router.push(`/dashboard/inspections/${insp.id}`);
    }
    setStarting(false);
  };

  const deleteInspection = async (id: string) => {
    if (!confirm("Delete this inspection and all its data?")) return;
    await fetch(`/api/inspections/${id}`, { method: "DELETE" });
    setInspections((prev) => prev.filter((i) => i.id !== id));
  };

  const publishedTemplates = templates.filter((t) => t.isPublished);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Inspections</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/inspections/pdf-templates"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <LayoutTemplate className="h-4 w-4" />
              PDF Templates
            </Link>
            {tab === "templates" ? (
              <button
                onClick={() => setShowNewTemplateModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Template
              </button>
            ) : (
              <button
                onClick={() => setTab("templates")}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                disabled={publishedTemplates.length === 0}
              >
                <Play className="h-4 w-4" />
                Start Inspection
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          <button
            onClick={() => setTab("inspections")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              tab === "inspections" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <ClipboardList className="h-4 w-4" />
            My Inspections
            <span className="ml-1 bg-gray-200 text-gray-600 text-[11px] rounded-full px-1.5 py-0.5 leading-none">
              {inspections.length}
            </span>
          </button>
          <button
            onClick={() => setTab("templates")}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              tab === "templates" ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <LayoutTemplate className="h-4 w-4" />
            Templates
            <span className="ml-1 bg-gray-200 text-gray-600 text-[11px] rounded-full px-1.5 py-0.5 leading-none">
              {templates.length}
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : tab === "inspections" ? (
          <InspectionsList
            inspections={inspections}
            onDelete={deleteInspection}
            onStartNew={() => setTab("templates")}
          />
        ) : (
          <TemplatesList
            templates={templates}
            onDelete={deleteTemplate}
            onStart={(t) => openStartModal(t.id, t.title)}
            onCreate={() => setShowNewTemplateModal(true)}
          />
        )}
      </div>

      {/* New Template Modal */}
      {showNewTemplateModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowNewTemplateModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">New Inspection Template</h2>
                <button onClick={() => setShowNewTemplateModal(false)} className="p-1.5 rounded-md hover:bg-gray-100">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                <input
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") createTemplate(); }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g. Daily Safety Inspection"
                  autoFocus
                />
                {/* Workspace selector */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Workspace (optional)</label>
                  <select
                    value={selectedWorkspaceId}
                    onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">— Select workspace —</option>
                    {workspaces.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
                {/* Board selector — shown when workspace is selected */}
                {selectedWorkspaceId && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Board (optional)</label>
                    {loadingBoards ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading boards…</div>
                    ) : (
                      <select
                        value={selectedBoardId}
                        onChange={(e) => setSelectedBoardId(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Select board —</option>
                        {boards.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Linking a board lets inspectors pick a job/project when starting an inspection.
              </p>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowNewTemplateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                <button
                  onClick={createTemplate}
                  disabled={!newTemplateName.trim() || creating}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating…" : "Create & Build"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Start Inspection Modal */}
      {showStartModal && (() => {
        const tpl = templates.find((t) => t.id === startTemplateId);
        const hasBoardLink = !!tpl?.boardId;
        const filteredItems = itemSearch
          ? boardItems.filter((i) => i.name.toLowerCase().includes(itemSearch.toLowerCase()))
          : boardItems;
        return (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowStartModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Start Inspection</h2>
                <button onClick={() => setShowStartModal(false)} className="p-1.5 rounded-md hover:bg-gray-100">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
              <div className="space-y-3">
                {/* Job / Item picker — shown when template is linked to a board */}
                {hasBoardLink && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Job / Project {tpl?.boardName ? `(${tpl.boardName})` : ""} *
                    </label>
                    {loadingItems ? (
                      <div className="flex items-center gap-2 text-xs text-gray-400 py-2"><Loader2 className="h-3 w-3 animate-spin" /> Loading items…</div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-400" />
                          <input
                            value={itemSearch}
                            onChange={(e) => setItemSearch(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Search items…"
                          />
                        </div>
                        <div className="max-h-40 overflow-y-auto mt-1.5 border border-gray-200 rounded-lg divide-y divide-gray-100">
                          {filteredItems.length === 0 && (
                            <p className="text-xs text-gray-400 p-3 text-center">No items found</p>
                          )}
                          {filteredItems.map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() => {
                                setSelectedItemId(item.id);
                                setStartTitle(item.name);
                              }}
                              className={cn(
                                "w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors",
                                selectedItemId === item.id ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"
                              )}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Inspection title *</label>
                  <input
                    value={startTitle}
                    onChange={(e) => setStartTitle(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g. Morning shift — 28 Feb 2026"
                    autoFocus={!hasBoardLink}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Site / Location</label>
                  <input
                    value={startSite}
                    onChange={(e) => setStartSite(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-5">
                <button onClick={() => setShowStartModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">Cancel</button>
                <button
                  onClick={startInspection}
                  disabled={!startTitle.trim() || starting || (hasBoardLink && !selectedItemId)}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {starting ? "Starting…" : "Start Inspection"}
                </button>
              </div>
            </div>
          </div>
        </>
        );
      })()}
    </div>
  );
}

// ── Inspections List ───────────────────────────────────────────────
function InspectionsList({
  inspections,
  onDelete,
  onStartNew,
}: {
  inspections: Inspection[];
  onDelete: (id: string) => void;
  onStartNew: () => void;
}) {
  if (inspections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ClipboardList className="h-12 w-12 text-gray-200 mb-3" />
        <h3 className="text-base font-semibold text-gray-500">No inspections yet</h3>
        <p className="text-sm text-gray-400 mt-1 mb-4">Start your first inspection from a template</p>
        <button
          onClick={onStartNew}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Play className="h-4 w-4" />
          Start Inspection
        </button>
      </div>
    );
  }

  const inProgress = inspections.filter((i) => i.status === "in_progress");
  const completed = inspections.filter((i) => i.status === "completed");

  return (
    <div className="max-w-5xl">
      {inProgress.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">In Progress</h2>
          <div className="space-y-2">
            {inProgress.map((i) => (
              <InspectionRow key={i.id} inspection={i} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
      {completed.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Completed</h2>
          <div className="space-y-2">
            {completed.map((i) => (
              <InspectionRow key={i.id} inspection={i} onDelete={onDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InspectionRow({ inspection: i, onDelete }: { inspection: Inspection; onDelete: (id: string) => void }) {
  const isComplete = i.status === "completed";
  const score = i.score;
  const scoreColor = score === null ? "text-gray-400" : score >= 80 ? "text-green-600" : score >= 50 ? "text-yellow-600" : "text-red-600";
  const scoreBg = score === null ? "bg-gray-100" : score >= 80 ? "bg-green-50 border-green-200" : score >= 50 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  return (
    <div className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 px-4 py-3 hover:shadow-sm transition-shadow group">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isComplete ? "bg-green-50" : "bg-blue-50"}`}>
        {isComplete ? (
          <CheckCircle2 className="h-5 w-5 text-green-600" />
        ) : (
          <Clock className="h-5 w-5 text-blue-500" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[14px] text-gray-900 truncate">{i.title}</div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
          {i.linkedItemName && (
            <>
              <span className="text-indigo-500 font-medium">{i.linkedItemName}</span>
              <span>·</span>
            </>
          )}
          {i.site && <span>{i.site}</span>}
          {i.site && <span>·</span>}
          <span>{i.conductedByName}</span>
          <span>·</span>
          <span>{new Date(i.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
        </div>
      </div>
      {isComplete && score !== null && (
        <div className={`px-3 py-1 rounded-full border text-sm font-bold ${scoreBg} ${scoreColor}`}>
          {score}%
        </div>
      )}
      {!isComplete && (
        <span className="text-xs text-blue-500 font-medium bg-blue-50 px-2 py-0.5 rounded-full">In Progress</span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Link
          href={`/dashboard/inspections/${i.id}`}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
          title={isComplete ? "View report" : "Continue inspection"}
        >
          {isComplete ? <BarChart3 className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
        </Link>
        <button onClick={() => onDelete(i.id)} className="p-1.5 rounded-md hover:bg-red-50 transition-colors">
          <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
        </button>
      </div>
    </div>
  );
}

// ── Templates List ─────────────────────────────────────────────────
function TemplatesList({
  templates,
  onDelete,
  onStart,
  onCreate,
}: {
  templates: InspectionTemplate[];
  onDelete: (id: string) => void;
  onStart: (t: InspectionTemplate) => void;
  onCreate: () => void;
}) {
  if (templates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LayoutTemplate className="h-12 w-12 text-gray-200 mb-3" />
        <h3 className="text-base font-semibold text-gray-500">No templates yet</h3>
        <p className="text-sm text-gray-400 mt-1 mb-4">Create your first inspection template</p>
        <button
          onClick={onCreate}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          New Template
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
      {templates.map((t) => {
        const totalQuestions = t.sections.reduce((s, sec) => s + sec.questions.length, 0);
        return (
          <div key={t.id} className="bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow group flex flex-col">
            <div className="p-4 flex-1">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold text-[14px] text-gray-900 leading-snug">{t.title}</h3>
                <span className={`flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${t.isPublished ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                  {t.isPublished ? <><Eye className="h-2.5 w-2.5" /> Published</> : <><EyeOff className="h-2.5 w-2.5" /> Draft</>}
                </span>
              </div>
              {t.description && (
                <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-2">{t.description}</p>
              )}
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span>{t.sections.length} section{t.sections.length !== 1 ? "s" : ""}</span>
                <span>·</span>
                <span>{totalQuestions} question{totalQuestions !== 1 ? "s" : ""}</span>
                {t.boardName && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[11px] font-medium">
                      {t.boardName}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="border-t border-gray-100 px-4 py-3 flex items-center gap-2">
              {t.isPublished ? (
                <button
                  onClick={() => onStart(t)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Play className="h-3 w-3" />
                  Start Inspection
                </button>
              ) : (
                <span className="text-xs text-gray-400">Publish to start inspections</span>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <Link
                  href={`/dashboard/inspections/templates/${t.id}`}
                  className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                  title="Edit template"
                >
                  <Edit3 className="h-3.5 w-3.5 text-gray-400" />
                </Link>
                <button
                  onClick={() => onDelete(t.id)}
                  className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
