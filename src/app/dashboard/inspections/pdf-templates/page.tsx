"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Check,
  X,
  Pencil,
  Star,
  Eye,
} from "lucide-react";
import type { PdfTemplate, PdfTemplateConfig } from "@/lib/types";
import { DEFAULT_PDF_CONFIG } from "@/lib/types";

export default function PdfTemplatesPage() {
  const [templates, setTemplates] = useState<PdfTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<PdfTemplateConfig>(DEFAULT_PDF_CONFIG);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/pdf-templates");
    if (res.ok) setTemplates(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const createTemplate = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    const res = await fetch("/api/pdf-templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, config: DEFAULT_PDF_CONFIG }),
    });
    if (res.ok) {
      const created: PdfTemplate = await res.json();
      setTemplates((prev) => [...prev, created]);
      setNewName("");
      setShowNew(false);
      // Open editor for the new template
      startEditing(created);
    }
    setCreating(false);
  };

  const startEditing = (t: PdfTemplate) => {
    setEditingId(t.id);
    setEditName(t.name);
    setEditDesc(t.description || "");
    setEditConfig(t.config ?? DEFAULT_PDF_CONFIG);
  };

  const saveTemplate = async () => {
    if (!editingId) return;
    setSaving(true);
    const res = await fetch(`/api/pdf-templates/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, description: editDesc, config: editConfig }),
    });
    if (res.ok) {
      const updated: PdfTemplate = await res.json();
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditingId(null);
    }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm("Delete this PDF template?")) return;
    await fetch(`/api/pdf-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const setAsDefault = async (id: string) => {
    const res = await fetch(`/api/pdf-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isDefault: true }),
    });
    if (res.ok) {
      setTemplates((prev) =>
        prev.map((t) => ({ ...t, isDefault: t.id === id }))
      );
    }
  };

  const editing = editingId ? templates.find((t) => t.id === editingId) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/inspections" className="p-1.5 rounded-md hover:bg-gray-100 transition-colors">
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-gray-900">PDF Template Library</h1>
          <p className="text-xs text-gray-500">Create and manage PDF export layouts for inspection reports</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Template list */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Templates ({templates.length})
            </span>
          </div>

          {templates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <FileText className="h-10 w-10 mb-2 text-gray-300" />
              <p className="text-sm">No PDF templates yet</p>
              <p className="text-xs mt-1">Create one to customize exports</p>
            </div>
          )}

          {templates.map((t) => (
            <div
              key={t.id}
              className={cn(
                "px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors",
                editingId === t.id ? "bg-blue-50" : "hover:bg-gray-50"
              )}
              onClick={() => startEditing(t)}
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-gray-900 flex-1 truncate">{t.name}</span>
                {t.isDefault && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium flex-shrink-0">DEFAULT</span>
                )}
              </div>
              {t.description && (
                <p className="text-xs text-gray-500 mt-1 truncate pl-6">{t.description}</p>
              )}
            </div>
          ))}

          {/* Create new inline */}
          {showNew && (
            <div className="px-4 py-3 border-b border-gray-100 bg-yellow-50">
              <div className="flex gap-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Template name…"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                  onKeyDown={(e) => e.key === "Enter" && createTemplate()}
                  autoFocus
                />
                <button
                  onClick={createTemplate}
                  disabled={!newName.trim() || creating}
                  className="p-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => { setShowNew(false); setNewName(""); }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="h-4 w-4 text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Editor panel */}
        <div className="flex-1 overflow-y-auto">
          {!editing ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <FileText className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-sm font-medium">Select a template to edit</p>
              <p className="text-xs mt-1">Or create a new one</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-6 space-y-6">
              {/* Name & Description */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</label>
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</label>
                  <input
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-blue-400"
                    placeholder="Optional description…"
                  />
                </div>
              </div>

              {/* Page Settings */}
              <ConfigSection title="Page Settings">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">Page Size</label>
                    <select
                      value={editConfig.pageSize}
                      onChange={(e) => setEditConfig({ ...editConfig, pageSize: e.target.value as "letter" | "a4" })}
                      className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none"
                    >
                      <option value="letter">Letter (8.5 × 11)</option>
                      <option value="a4">A4 (210 × 297mm)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Orientation</label>
                    <select
                      value={editConfig.orientation}
                      onChange={(e) => setEditConfig({ ...editConfig, orientation: e.target.value as "portrait" | "landscape" })}
                      className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none"
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs text-gray-500">Margins (pt)</label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {(["top", "right", "bottom", "left"] as const).map((side) => (
                      <div key={side}>
                        <span className="text-[10px] text-gray-400 capitalize">{side}</span>
                        <input
                          type="number"
                          min={10}
                          max={100}
                          value={editConfig.margins[side]}
                          onChange={(e) => setEditConfig({
                            ...editConfig,
                            margins: { ...editConfig.margins, [side]: parseInt(e.target.value) || 50 },
                          })}
                          className="w-full text-sm border border-gray-200 rounded px-2 py-1 outline-none focus:border-blue-400 text-center"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </ConfigSection>

              {/* Colors */}
              <ConfigSection title="Colors">
                <div className="grid grid-cols-2 gap-4">
                  {(
                    [
                      { key: "primary", label: "Primary" },
                      { key: "accent", label: "Accent" },
                      { key: "headerBg", label: "Header Background" },
                      { key: "headerText", label: "Header Text" },
                    ] as const
                  ).map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editConfig.colors[key]}
                        onChange={(e) => setEditConfig({
                          ...editConfig,
                          colors: { ...editConfig.colors, [key]: e.target.value },
                        })}
                        className="w-8 h-8 rounded border border-gray-200 cursor-pointer"
                      />
                      <div>
                        <span className="text-xs text-gray-600">{label}</span>
                        <span className="text-[10px] text-gray-400 ml-1">{editConfig.colors[key]}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ConfigSection>

              {/* Header Settings */}
              <ConfigSection title="Header">
                <div>
                  <label className="text-xs text-gray-500">Company Name</label>
                  <input
                    value={editConfig.header.companyName}
                    onChange={(e) => setEditConfig({
                      ...editConfig,
                      header: { ...editConfig.header, companyName: e.target.value },
                    })}
                    className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                    placeholder="Your company name (optional)"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {(
                    [
                      { key: "showTitle", label: "Show Title" },
                      { key: "showStatus", label: "Show Status Badge" },
                      { key: "showDate", label: "Show Dates" },
                      { key: "showScore", label: "Show Score" },
                      { key: "showSite", label: "Show Site" },
                      { key: "showConductor", label: "Show Conductor" },
                      { key: "showNcr", label: "Show NCR Number" },
                    ] as const
                  ).map(({ key, label }) => (
                    <ToggleRow
                      key={key}
                      label={label}
                      checked={editConfig.header[key]}
                      onChange={(v) => setEditConfig({
                        ...editConfig,
                        header: { ...editConfig.header, [key]: v },
                      })}
                    />
                  ))}
                </div>
              </ConfigSection>

              {/* Section Settings */}
              <ConfigSection title="Sections">
                <div className="grid grid-cols-2 gap-3">
                  <ToggleRow
                    label="Show Section Numbers"
                    checked={editConfig.sections.showSectionNumbers}
                    onChange={(v) => setEditConfig({
                      ...editConfig,
                      sections: { ...editConfig.sections, showSectionNumbers: v },
                    })}
                  />
                  <ToggleRow
                    label="Show Question Numbers"
                    checked={editConfig.sections.showQuestionNumbers}
                    onChange={(v) => setEditConfig({
                      ...editConfig,
                      sections: { ...editConfig.sections, showQuestionNumbers: v },
                    })}
                  />
                </div>
              </ConfigSection>

              {/* Content Settings */}
              <ConfigSection title="Content">
                <div className="grid grid-cols-2 gap-3">
                  {(
                    [
                      { key: "showFlags", label: "Show Flags" },
                      { key: "showNotes", label: "Show Notes" },
                      { key: "showActions", label: "Show Corrective Actions" },
                      { key: "showSignatures", label: "Show Signatures" },
                      { key: "showEmptyQuestions", label: "Show Unanswered Questions" },
                    ] as const
                  ).map(({ key, label }) => (
                    <ToggleRow
                      key={key}
                      label={label}
                      checked={editConfig.content[key]}
                      onChange={(v) => setEditConfig({
                        ...editConfig,
                        content: { ...editConfig.content, [key]: v },
                      })}
                    />
                  ))}
                </div>
              </ConfigSection>

              {/* Footer Settings */}
              <ConfigSection title="Footer">
                <div className="grid grid-cols-2 gap-3">
                  <ToggleRow
                    label="Show Page Numbers"
                    checked={editConfig.footer.showPageNumbers}
                    onChange={(v) => setEditConfig({
                      ...editConfig,
                      footer: { ...editConfig.footer, showPageNumbers: v },
                    })}
                  />
                  <ToggleRow
                    label="Show Confidential Notice"
                    checked={editConfig.footer.showConfidential}
                    onChange={(v) => setEditConfig({
                      ...editConfig,
                      footer: { ...editConfig.footer, showConfidential: v },
                    })}
                  />
                </div>
                <div className="mt-3">
                  <label className="text-xs text-gray-500">Custom Footer Text</label>
                  <input
                    value={editConfig.footer.customText}
                    onChange={(e) => setEditConfig({
                      ...editConfig,
                      footer: { ...editConfig.footer, customText: e.target.value },
                    })}
                    className="w-full mt-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400"
                    placeholder="Optional footer text…"
                  />
                </div>
              </ConfigSection>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={saveTemplate}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save Changes
                </button>
                {!editing.isDefault && (
                  <button
                    onClick={() => setAsDefault(editing.id)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <Star className="h-4 w-4" />
                    Set as Default
                  </button>
                )}
                <button
                  onClick={() => setEditingId(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <div className="flex-1" />
                <button
                  onClick={() => deleteTemplate(editing.id)}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Reusable sub-components ─────────────────────────────────────────

function ConfigSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-8 h-[18px] rounded-full transition-colors duration-200",
          checked ? "bg-blue-600" : "bg-gray-300"
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform duration-200",
            checked && "translate-x-[14px]"
          )}
        />
      </button>
      <span className="text-xs text-gray-700">{label}</span>
    </label>
  );
}
