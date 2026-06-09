"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Wrench, X, AlertCircle } from "lucide-react";

interface Workspace { id: string; name: string }
interface Skill { id: string; name: string; description: string | null }

export default function SkillsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const r = await fetch(`/api/production-skills?workspaceId=${workspaceId}`).then((x) => x.json());
    setSkills(r.data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.name) { setError("Name required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/production-skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, name: form.name, description: form.description || undefined }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm({ name: "", description: "" }); load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Skills</h1>
        </div>
        <button onClick={() => { setForm({ name: "", description: "" }); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Skill
        </button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <p className="mb-4 text-sm text-gray-500">Skills are assigned to employees from their profile and required by process stages. The planning engine checks that enough skilled people exist for each stage.</p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium">Skill</th><th className="px-4 py-3 font-medium">Description</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : skills.length === 0 ? <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-500">No skills yet.</td></tr>
            : skills.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">{s.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Skill</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Name *</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Certified Welder" className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <label className="block"><span className="text-xs text-gray-500">Description</span>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
