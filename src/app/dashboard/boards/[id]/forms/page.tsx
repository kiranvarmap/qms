"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Loader2, ExternalLink, Trash2, Eye, EyeOff,
  Copy, Check, FileText, Type, Hash, Calendar,
  ToggleLeft, Flag, Circle, AlignLeft, Link2, Settings,
  Layers, Share2, MousePointer, ChevronDown, ChevronRight,
  X, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────
interface Form {
  id: string; name: string; description: string | null; isPublic: boolean;
  slug: string; submitMessage: string | null; isActive: boolean; createdAt: string;
}
interface FormField {
  id: string; columnId: string | null; label: string; helpText: string | null;
  isVisible: boolean; isRequired: boolean; prefillParam: string | null; position: number;
}
interface LabelOption { id: string; text: string; color?: string; }
interface Column { id: string; name: string; type: string; config?: { labels?: LabelOption[] }; }

// ── Helpers ───────────────────────────────────────────────────────
function colTypeIcon(type: string) {
  switch (type) {
    case "text":     return <Type className="h-3 w-3" />;
    case "number":   return <Hash className="h-3 w-3" />;
    case "date":     return <Calendar className="h-3 w-3" />;
    case "status":   return <Circle className="h-3 w-3" />;
    case "priority": return <Flag className="h-3 w-3" />;
    case "checkbox": return <ToggleLeft className="h-3 w-3" />;
    case "link":     return <Link2 className="h-3 w-3" />;
    default:         return <AlignLeft className="h-3 w-3" />;
  }
}
function colTypeColor(type: string) {
  switch (type) {
    case "text":     return "bg-blue-100 text-blue-600";
    case "number":   return "bg-purple-100 text-purple-600";
    case "date":     return "bg-rose-100 text-rose-600";
    case "status":   return "bg-amber-100 text-amber-600";
    case "priority": return "bg-orange-100 text-orange-600";
    case "checkbox": return "bg-teal-100 text-teal-600";
    case "link":     return "bg-indigo-100 text-indigo-600";
    default:         return "bg-gray-100 text-gray-500";
  }
}

// ── Canvas Field Renderer ─────────────────────────────────────────
function FieldPreview({ field, col, isSelected, onClick }: {
  field: FormField; col: Column | undefined; isSelected: boolean; onClick: () => void;
}) {
  const labels = col?.config?.labels ?? [];
  const type = col?.type ?? "text";

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative bg-white rounded-xl border-2 cursor-pointer transition-all px-5 py-4 select-none",
        isSelected ? "border-blue-500 shadow-md shadow-blue-100" : "border-transparent hover:border-gray-200 hover:shadow-sm",
        !field.isVisible && "opacity-40"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <GripVertical className="h-4 w-4 text-gray-200 flex-shrink-0 cursor-grab" />
        {col && (
          <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded", colTypeColor(col.type))}>
            {colTypeIcon(col.type)}{col.type}
          </span>
        )}
        {field.isRequired && <span className="text-[10px] font-semibold text-red-500">Required</span>}
        {!field.isVisible && (
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-gray-400"><EyeOff className="h-3 w-3" />Hidden</span>
        )}
      </div>

      <label className="block text-sm font-semibold text-gray-800 mb-1.5">
        {field.label || "Untitled question"}
        {field.isRequired && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {field.helpText && <p className="text-xs text-gray-400 mb-2">{field.helpText}</p>}

      {/* Render the appropriate input widget */}
      {(type === "status" || type === "priority" || type === "dropdown") && labels.length > 0 ? (
        <select className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 pointer-events-none text-gray-500">
          <option value="">Select an option…</option>
          {labels.map(l => <option key={l.id} value={l.id}>{l.text}</option>)}
        </select>
      ) : type === "checkbox" ? (
        <div className="flex items-center gap-2 pointer-events-none">
          <div className="w-4 h-4 rounded border-2 border-gray-300 bg-gray-50 flex-shrink-0" />
          <span className="text-sm text-gray-400">{field.label}</span>
        </div>
      ) : type === "date" ? (
        <input type="date" disabled className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-400" />
      ) : type === "number" ? (
        <input type="number" disabled placeholder="0" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-400" />
      ) : type === "link" ? (
        <input type="url" disabled placeholder="https://" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-400" />
      ) : (
        <input type="text" disabled placeholder="Type your answer…" className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-gray-50 text-gray-400" />
      )}

      {isSelected && (
        <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 rounded-full" />
      )}
    </div>
  );
}

// ── Right Settings Panel ──────────────────────────────────────────
function SettingsPanel({ field, col, onUpdate, onDelete, onClose }: {
  field: FormField; col: Column | undefined;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="w-72 border-l border-gray-200 bg-white flex flex-col flex-shrink-0 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-900">Question settings</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">
        {/* Column badge */}
        {col && (
          <div className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg", colTypeColor(col.type))}>
            {colTypeIcon(col.type)}
            {col.name} <span className="opacity-60">({col.type})</span>
          </div>
        )}

        {/* Label */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Question label</label>
          <input
            value={field.label}
            onChange={e => onUpdate({ label: e.target.value })}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>

        {/* Help text */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Help text</label>
          <textarea
            value={field.helpText ?? ""}
            onChange={e => onUpdate({ helpText: e.target.value || null })}
            rows={2}
            placeholder="Optional description shown under the question…"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
          />
        </div>

        {/* Pre-fill */}
        <div>
          <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Pre-fill from URL param</label>
          <div className="flex gap-2">
            <input
              value={field.prefillParam ?? ""}
              onChange={e => onUpdate({ prefillParam: e.target.value.trim() || null })}
              placeholder="e.g. job_id"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono"
            />
          </div>
          {field.prefillParam && (
            <p className="text-[11px] text-blue-600 mt-1">
              Add <code className="bg-blue-50 px-1 rounded">?{field.prefillParam}=value</code> to your form URL to pre-fill this field.
            </p>
          )}
        </div>

        {/* Toggles */}
        <div className="bg-gray-50 rounded-xl border border-gray-100 divide-y divide-gray-100">
          {/* Required */}
          <div className="flex items-center justify-between px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Required</p>
              <p className="text-[11px] text-gray-400">Must be answered to submit</p>
            </div>
            <button
              onClick={() => onUpdate({ isRequired: !field.isRequired })}
              className={cn("relative w-10 h-5 rounded-full transition-colors flex-shrink-0", field.isRequired ? "bg-blue-600" : "bg-gray-200")}
            >
              <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", field.isRequired ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </div>
          {/* Visible */}
          <div className="flex items-center justify-between px-3 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">Visible</p>
              <p className="text-[11px] text-gray-400">Show this question on the form</p>
            </div>
            <button
              onClick={() => onUpdate({ isVisible: !field.isVisible })}
              className={cn("relative w-10 h-5 rounded-full transition-colors flex-shrink-0", field.isVisible ? "bg-blue-600" : "bg-gray-200")}
            >
              <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", field.isVisible ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={onDelete}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
        >
          <Trash2 className="h-3.5 w-3.5" />Remove question
        </button>
      </div>
    </div>
  );
}

// ── Add Columns Modal ─────────────────────────────────────────────
function AddContentModal({ columns, addedColumnIds, onAdd, onClose }: {
  columns: Column[];
  addedColumnIds: Set<string>;
  onAdd: (colIds: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Add content</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Board columns</p>
          <div className="space-y-1">
            {columns.map(col => {
              const already = addedColumnIds.has(col.id);
              const checked = selected.has(col.id);
              return (
                <button
                  key={col.id}
                  onClick={() => !already && toggle(col.id)}
                  disabled={already}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                    already ? "opacity-50 cursor-default" : checked ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50"
                  )}
                >
                  <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0", colTypeColor(col.type))}>
                    {colTypeIcon(col.type)}{col.type}
                  </span>
                  <span className="flex-1 text-sm text-gray-700 font-medium">{col.name}</span>
                  {already ? (
                    <Check className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                  ) : checked ? (
                    <div className="w-4 h-4 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
                      <Check className="h-2.5 w-2.5 text-white" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded border-2 border-gray-200 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
            <button
              onClick={() => { onAdd(Array.from(selected)); onClose(); }}
              disabled={selected.size === 0}
              className="px-4 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Add to form
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────
const TABS = ["Build", "Settings", "Share"] as const;
type Tab = typeof TABS[number];
const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition";

export default function FormsPage() {
  const params = useParams();
  const boardId = params.id as string;

  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedForm, setSelectedForm] = useState<Form | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("Build");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingField, setSavingField] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const fetchForms = useCallback(async () => {
    setLoading(true);
    try {
      const [fr, br] = await Promise.all([
        fetch(`/api/boards/${boardId}/forms`),
        fetch(`/api/boards/${boardId}`),
      ]);
      const fd = await fr.json();
      const bd = await br.json();
      setForms(Array.isArray(fd) ? fd : []);
      setColumns(bd.columns || []);
    } finally { setLoading(false); }
  }, [boardId]);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  // Add multiple fields from board columns. Accepts an explicit formId for use during creation.
  const addFieldsFromColumns = async (colIds: string[], forFormId?: string, baseFields?: FormField[]) => {
    const fid = forFormId ?? selectedForm?.id;
    if (!fid) return [];
    const newFields = [...(baseFields ?? fields)];
    for (const colId of colIds) {
      const col = columns.find(c => c.id === colId);
      if (!col) continue;
      const res = await fetch(`/api/forms/${fid}/fields`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: colId, label: col.name, isVisible: true, isRequired: false, position: newFields.length }),
      });
      if (res.ok) { const field = await res.json(); newFields.push(field); }
    }
    return newFields;
  };

  const selectForm = async (form: Form) => {
    setSelectedForm(form); setNameValue(form.name); setActiveTab("Build");
    setSelectedFieldId(null);
    setLoadingFields(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/fields`);
      const data = await res.json();
      let loaded: FormField[] = Array.isArray(data)
        ? data.sort((a: FormField, b: FormField) => a.position - b.position)
        : [];
      // If this form has no fields yet, auto-populate all board columns
      if (loaded.length === 0 && columns.length > 0) {
        const allColIds = columns.map(c => c.id);
        loaded = await addFieldsFromColumns(allColIds, form.id, []);
      }
      setFields(loaded);
    } finally { setLoadingFields(false); }
  };

  const createForm = async () => {
    setCreating(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/forms`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New Form" }),
      });
      if (res.ok) {
        const form = await res.json();
        setForms(p => [...p, form]);
        // Auto-add all board columns as fields so nothing is required to select
        const allColIds = columns.map(c => c.id);
        const populated = await addFieldsFromColumns(allColIds, form.id, []);
        setSelectedForm(form);
        setNameValue(form.name);
        setActiveTab("Build");
        setSelectedFieldId(null);
        setFields(populated);
      }
    } finally { setCreating(false); }
  };

  const deleteForm = async (formId: string) => {
    if (!confirm("Delete this form?")) return;
    await fetch(`/api/forms/${formId}`, { method: "DELETE" });
    setForms(p => p.filter(f => f.id !== formId));
    if (selectedForm?.id === formId) { setSelectedForm(null); setFields([]); }
  };

  const updateForm = async (updates: Partial<Form>) => {
    if (!selectedForm) return;
    const optimistic = { ...selectedForm, ...updates };
    setSelectedForm(optimistic);
    setForms(p => p.map(f => f.id === optimistic.id ? optimistic : f));
    const res = await fetch(`/api/forms/${selectedForm.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates),
    });
    if (res.ok) {
      const updated = await res.json();
      setSelectedForm(updated);
      setForms(p => p.map(f => f.id === updated.id ? updated : f));
    }
  };

  // Single field update — optimistically update state then persist
  const updateField = async (fieldId: string, updates: Partial<FormField>) => {
    const updated = fields.map(f => f.id === fieldId ? { ...f, ...updates } : f);
    setFields(updated);
    setSavingField(true);
    try {
      await fetch(`/api/forms/${selectedForm!.id}/fields`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: updated }),
      });
    } finally { setSavingField(false); }
  };

  const deleteField = async (fieldId: string) => {
    const updated = fields.filter(f => f.id !== fieldId);
    setFields(updated);
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
    await fetch(`/api/forms/${selectedForm!.id}/fields`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields: updated }),
    });
  };

  // Quick toggle helpers used in the content tree panel
  const toggleFieldVisible = (fieldId: string) => {
    const f = fields.find(x => x.id === fieldId);
    if (f) updateField(fieldId, { isVisible: !f.isVisible });
  };
  const toggleFieldRequired = (fieldId: string) => {
    const f = fields.find(x => x.id === fieldId);
    if (f) updateField(fieldId, { isRequired: !f.isRequired });
  };

  const publicUrl = selectedForm ? `${typeof window !== "undefined" ? window.location.origin : ""}/forms/${selectedForm.slug}` : "";
  const copyLink = () => { navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const getColForField = (field: FormField) => columns.find(c => c.id === field.columnId);
  const selectedField = fields.find(f => f.id === selectedFieldId) ?? null;
  const addedColumnIds = new Set(fields.map(f => f.columnId).filter(Boolean) as string[]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#f4f5f7]">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <Link href={`/dashboard/boards/${boardId}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
          <FileText className="h-3.5 w-3.5 text-white" />
        </div>

        {selectedForm ? (
          editingName ? (
            <input value={nameValue} onChange={e => setNameValue(e.target.value)}
              onBlur={() => { updateForm({ name: nameValue }); setEditingName(false); }}
              onKeyDown={e => { if (e.key === "Enter") { updateForm({ name: nameValue }); setEditingName(false); } if (e.key === "Escape") setEditingName(false); }}
              className="text-base font-bold text-gray-900 bg-transparent border-b-2 border-blue-400 focus:outline-none flex-1 min-w-0" autoFocus />
          ) : (
            <button onClick={() => setEditingName(true)} className="text-base font-bold text-gray-900 hover:text-blue-600 transition-colors text-left truncate flex-1 min-w-0">
              {selectedForm.name}
            </button>
          )
        ) : (
          <span className="text-base font-bold text-gray-900 flex-1">Forms</span>
        )}

        {selectedForm && (
          <>
            {/* Build / Settings / Share tabs */}
            <div className="flex items-center gap-0.5 bg-gray-100 p-0.5 rounded-lg">
              {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all", activeTab === tab ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700")}>
                  {tab}
                </button>
              ))}
            </div>
            <a href={publicUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />Preview
            </a>
          </>
        )}

        <button onClick={createForm} disabled={creating}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm active:scale-95 transition-all">
          {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}New Form
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Forms list sidebar */}
        <div className={cn("border-r border-gray-200 bg-white flex-shrink-0 flex flex-col transition-all", sidebarOpen ? "w-56" : "w-0 overflow-hidden")}>
          <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Forms</p>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {loading ? (
              <div className="flex items-center justify-center py-10"><Loader2 className="h-4 w-4 animate-spin text-gray-300" /></div>
            ) : forms.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <FileText className="h-7 w-7 text-gray-200 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No forms yet</p>
              </div>
            ) : forms.map(form => (
              <div key={form.id} onClick={() => selectForm(form)}
                className={cn("group flex items-start gap-2 px-2 py-2.5 mx-1 rounded-lg cursor-pointer transition-all",
                  selectedForm?.id === form.id ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50")}>
                <FileText className={cn("h-4 w-4 flex-shrink-0 mt-0.5", selectedForm?.id === form.id ? "text-blue-600" : "text-gray-300")} />
                <div className="flex-1 min-w-0">
                  <p className={cn("text-xs font-semibold truncate", selectedForm?.id === form.id ? "text-blue-900" : "text-gray-700")}>{form.name}</p>
                  <span className={cn("text-[10px] px-1 py-0.5 rounded font-medium", form.isActive ? "text-green-600" : "text-gray-400")}>
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <button onClick={e => { e.stopPropagation(); deleteForm(form.id); }}
                  className="hidden group-hover:flex p-0.5 rounded text-gray-300 hover:text-red-500 flex-shrink-0">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {!selectedForm ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
              <MousePointer className="h-7 w-7 text-blue-500" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Select a form to edit</h3>
              <p className="text-xs text-gray-400">Or create a new one to get started</p>
            </div>
            <button onClick={createForm} disabled={creating}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
              <Plus className="h-4 w-4" />Create Form
            </button>
          </div>
        ) : (
          <div className="flex flex-1 min-w-0 overflow-hidden">

            {/* ── Build tab: content list + canvas ─────────── */}
            {activeTab === "Build" && (
              <>
                {/* Content tree panel */}
                <div className="w-60 border-r border-gray-200 bg-[#fafafa] flex-shrink-0 flex flex-col">
                  <div className="px-3 py-2.5 border-b border-gray-100">
                    <button className="flex items-center gap-1 text-[11px] font-semibold text-gray-500 w-full">
                      <ChevronDown className="h-3 w-3" />Content
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                    <div className="px-2 py-1">
                      <div className="flex items-center gap-1 px-2 py-1 mb-1">
                        <ChevronRight className="h-3 w-3 text-gray-400" />
                        <span className="text-[11px] text-gray-500 font-semibold">Page 1</span>
                      </div>
                      {fields.length === 0 ? (
                        <p className="text-[11px] text-gray-400 italic px-4 py-2">No questions yet</p>
                      ) : (
                        <div className="space-y-0.5 pl-1">
                          {fields.map(field => {
                            const col = getColForField(field);
                            return (
                              <div key={field.id}
                                className={cn("group w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all cursor-pointer",
                                  selectedFieldId === field.id ? "bg-blue-100" : "hover:bg-gray-100")}>
                                {/* Select field */}
                                <button className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                                  onClick={() => setSelectedFieldId(field.id)}>
                                  <span className={cn("flex-shrink-0", col ? colTypeColor(col.type) : "text-gray-300")}>
                                    {colTypeIcon(col?.type ?? "text")}
                                  </span>
                                  <span className={cn("text-[11px] font-medium truncate", selectedFieldId === field.id ? "text-blue-800" : "text-gray-600", !field.isVisible && "opacity-50")}>
                                    {field.label || "Untitled"}
                                  </span>
                                </button>
                                {/* Inline visibility toggle */}
                                <button
                                  title={field.isVisible ? "Hide from form" : "Show on form"}
                                  onClick={e => { e.stopPropagation(); toggleFieldVisible(field.id); }}
                                  className={cn("flex-shrink-0 p-0.5 rounded transition-colors",
                                    field.isVisible ? "text-blue-500 hover:text-blue-700" : "text-gray-300 hover:text-gray-500")}
                                >
                                  {field.isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* + Add content */}
                  <div className="p-2 border-t border-gray-200">
                    <button onClick={() => setShowAddModal(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 border-dashed">
                      <Plus className="h-3.5 w-3.5" />Add content
                    </button>
                  </div>
                </div>

                {/* Canvas */}
                <div className="flex-1 overflow-y-auto bg-[#f4f5f7]" onClick={() => setSelectedFieldId(null)}>
                  <div className="max-w-2xl mx-auto px-6 py-8">
                    {/* Form header */}
                    <div className="bg-white rounded-2xl border border-gray-200 px-6 py-5 mb-4 shadow-sm">
                      <h2 className="text-lg font-bold text-gray-900">{selectedForm.name}</h2>
                      {selectedForm.description && (
                        <p className="text-sm text-gray-500 mt-1">{selectedForm.description}</p>
                      )}
                    </div>

                    {loadingFields ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                      </div>
                    ) : fields.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <Layers className="h-10 w-10 text-gray-200" />
                        <p className="text-sm text-gray-400">No questions yet</p>
                        <button onClick={() => setShowAddModal(true)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          <Plus className="h-3.5 w-3.5" />Add content
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2" onClick={e => e.stopPropagation()}>
                        {fields.map(field => (
                          <FieldPreview
                            key={field.id}
                            field={field}
                            col={getColForField(field)}
                            isSelected={selectedFieldId === field.id}
                            onClick={() => setSelectedFieldId(prev => prev === field.id ? null : field.id)}
                          />
                        ))}
                      </div>
                    )}

                    {fields.length > 0 && (
                      <div className="mt-4 flex justify-end">
                        <div className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg opacity-60 pointer-events-none">
                          Submit
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right settings panel */}
                {selectedField && (
                  <SettingsPanel
                    field={selectedField}
                    col={getColForField(selectedField)}
                    onUpdate={updates => updateField(selectedField.id, updates)}
                    onDelete={() => deleteField(selectedField.id)}
                    onClose={() => setSelectedFieldId(null)}
                  />
                )}
                {savingField && (
                  <div className="fixed bottom-4 right-4 flex items-center gap-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />Saving…
                  </div>
                )}
              </>
            )}

            {/* ── Settings tab ──────────────────────────────── */}
            {activeTab === "Settings" && (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
                    <h3 className="text-sm font-bold text-gray-900">Form details</h3>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Form name</label>
                      <input value={nameValue} onChange={e => setNameValue(e.target.value)} onBlur={() => updateForm({ name: nameValue })} className={inputCls + " font-semibold"} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
                      <textarea defaultValue={selectedForm.description ?? ""} onBlur={e => updateForm({ description: e.target.value || null })}
                        className={inputCls + " resize-none"} rows={2} placeholder="What is this form for?" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Success message</label>
                      <input defaultValue={selectedForm.submitMessage ?? ""} onBlur={e => updateForm({ submitMessage: e.target.value || null })}
                        className={inputCls} placeholder="Thank you for your submission!" />
                    </div>
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
                    <div className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Accept submissions</p>
                        <p className="text-xs text-gray-400 mt-0.5">Allow new responses to be submitted</p>
                      </div>
                      <button onClick={() => updateForm({ isActive: !selectedForm.isActive })}
                        className={cn("relative w-10 h-5 rounded-full transition-colors", selectedForm.isActive ? "bg-blue-600" : "bg-gray-200")}>
                        <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", selectedForm.isActive ? "translate-x-5" : "translate-x-0.5")} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between px-5 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Public access</p>
                        <p className="text-xs text-gray-400 mt-0.5">No login required to submit</p>
                      </div>
                      <button onClick={() => updateForm({ isPublic: !selectedForm.isPublic })}
                        className={cn("relative w-10 h-5 rounded-full transition-colors", selectedForm.isPublic ? "bg-blue-600" : "bg-gray-200")}>
                        <span className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", selectedForm.isPublic ? "translate-x-5" : "translate-x-0.5")} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Share tab ─────────────────────────────────── */}
            {activeTab === "Share" && (
              <div className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-6 py-6 space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                        <Share2 className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">Share this form</h3>
                        <p className="text-xs text-gray-400">Distribute the link to collect responses</p>
                      </div>
                    </div>
                    {!selectedForm.isPublic ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                        Enable <strong>Public access</strong> in Settings to get a shareable link.
                      </div>
                    ) : (
                      <>
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 flex items-center gap-2 mb-3">
                          <span className="text-xs text-gray-500 truncate flex-1 font-mono">{publicUrl}</span>
                          <button onClick={copyLink} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                            copied ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700 hover:bg-blue-200")}>
                            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            {copied ? "Copied!" : "Copy link"}
                          </button>
                          <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 transition-colors">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <div className={cn("w-2 h-2 rounded-full flex-shrink-0", selectedForm.isActive ? "bg-green-500" : "bg-gray-300")} />
                          <p className="text-xs text-blue-700">
                            {selectedForm.isActive ? "This form is currently accepting responses." : "Enable this form in Settings to accept responses."}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                  {selectedForm.isPublic && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                      <h4 className="text-sm font-bold text-gray-900 mb-2">Embed in your website</h4>
                      <div className="bg-gray-900 rounded-xl p-3 font-mono text-xs text-green-400 overflow-x-auto whitespace-pre">
                        {`<iframe src="${publicUrl}" width="100%" height="600" frameborder="0" />`}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add content modal */}
      {showAddModal && (
        <AddContentModal
          columns={columns}
          addedColumnIds={addedColumnIds}
          onAdd={addFieldsFromColumns}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}

