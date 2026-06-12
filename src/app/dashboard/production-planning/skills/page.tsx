"use client";

import Link from "next/link";
import { NativeSelect, useConfirm, useToast } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import { Add as Plus, Settings as Wrench, CloseSmall as X, Alert as AlertCircle, Group as Users, Edit as Pencil, Delete as Trash2 } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Skill { id: string; name: string; description: string | null; holdersCount?: number }
interface Employee { id: string; employeeId: string; name: string; department: string | null }
type EmpSkill = { skillId: string; level: string };

export default function SkillsPage() {
  const confirmAction = useConfirm();
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editSkill, setEditSkill] = useState<Skill | null>(null);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Link-employees modal state ──
  const [linkSkill, setLinkSkill] = useState<Skill | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empSkillMap, setEmpSkillMap] = useState<Record<string, EmpSkill[]>>({});
  const [linkLoading, setLinkLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState("");

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
    const res = editSkill
      ? await fetch(`/api/production-skills/${editSkill.id}?workspaceId=${workspaceId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name, description: form.description || null }) })
      : await fetch("/api/production-skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, name: form.name, description: form.description || undefined }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setEditSkill(null); setForm({ name: "", description: "" }); load();
  };

  const removeSkill = async (sk: Skill) => {
    if (!(await confirmAction(`Delete skill "${sk.name}"? Employees holding it and stages requiring it will lose the reference.`))) return;
    const res = await fetch(`/api/production-skills/${sk.id}?workspaceId=${workspaceId}`, { method: "DELETE" });
    if (!res.ok) { const e = await res.json().catch(() => ({})); toast(e.error || "Failed to delete", "warning"); return; }
    load();
  };

  // ── Link employees to a skill, right from this page ──
  const openLink = async (skill: Skill) => {
    setLinkSkill(skill);
    setLinkError("");
    setLinkLoading(true);
    try {
      const emps: Employee[] = await fetch("/api/employees").then((r) => r.json());
      const list = Array.isArray(emps) ? emps : [];
      setEmployees(list);
      const entries = await Promise.all(
        list.map(async (e) => {
          const r = await fetch(`/api/employees/${e.id}/skills?workspaceId=${workspaceId}`).then((x) => x.json()).catch(() => ({}));
          return [e.id, (r.data ?? []).map((s: { skillId: string; level: string }) => ({ skillId: s.skillId, level: s.level }))] as const;
        })
      );
      setEmpSkillMap(Object.fromEntries(entries));
    } catch {
      setLinkError("Failed to load employees.");
    } finally {
      setLinkLoading(false);
    }
  };

  const closeLink = () => { setLinkSkill(null); load(); };

  const toggleEmployee = async (emp: Employee) => {
    if (!linkSkill) return;
    const current = empSkillMap[emp.id] ?? [];
    const has = current.some((s) => s.skillId === linkSkill.id);
    const next = has
      ? current.filter((s) => s.skillId !== linkSkill.id)
      : [...current, { skillId: linkSkill.id, level: "qualified" }];
    setTogglingId(emp.id);
    setLinkError("");
    try {
      const res = await fetch(`/api/employees/${emp.id}/skills`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, skills: next }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setLinkError(
          e.error === "Forbidden"
            ? "You don't have inventory/production access in this workspace, so skills can't be saved."
            : e.error || `Failed to save (HTTP ${res.status}).`
        );
        return;
      }
      const saved = await res.json().catch(() => null);
      const rows: EmpSkill[] = (saved?.data ?? next).map((x: EmpSkill) => ({ skillId: x.skillId, level: x.level }));
      setEmpSkillMap((p) => ({ ...p, [emp.id]: rows }));
    } catch {
      setLinkError("Network error — change was not saved.");
    } finally {
      setTogglingId(null);
    }
  };

  const holdersOf = (skillId: string) =>
    employees.filter((e) => (empSkillMap[e.id] ?? []).some((s) => s.skillId === skillId)).length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Skills</h1>
        </div>
        <button onClick={() => { setEditSkill(null); setForm({ name: "", description: "" }); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Skill
        </button>
      </div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <p className="mb-4 text-sm text-gray-500">Click &ldquo;Link employees&rdquo; on a skill to choose who holds it. The planning engine checks that enough skilled people exist for each process stage.</p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium">Skill</th><th className="px-4 py-3 font-medium">Description</th><th className="px-4 py-3 font-medium">Employees with skill</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : skills.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No skills yet.</td></tr>
            : skills.map((s) => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 font-medium">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">{s.description || "—"}</td>
                <td className="px-4 py-3 flex items-center gap-2">
                  <button
                    onClick={() => openLink(s)}
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] text-xs font-medium transition-colors ${
                      Number(s.holdersCount ?? 0) > 0
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : "bg-red-50 text-red-700 hover:bg-red-100"
                    }`}
                    title="Choose which employees hold this skill"
                  >
                    <Users className="h-3 w-3" />
                    {Number(s.holdersCount ?? 0) > 0 ? `${s.holdersCount} linked` : "0 linked"} — Link employees
                  </button>
                  <button onClick={() => { setEditSkill(s); setForm({ name: s.name, description: s.description ?? "" }); setError(""); setShowCreate(true); }} title="Edit skill" className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => removeSkill(s)} title="Delete skill" className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Skill modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">{editSkill ? `Edit Skill — ${editSkill.name}` : "New Skill"}</h2>
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
              <button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : editSkill ? "Save" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Link employees modal */}
      {linkSkill && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeLink}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900">Link employees — {linkSkill.name}</h2>
              <button onClick={closeLink} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Tick everyone who holds this skill. Changes save immediately. Currently linked: {holdersOf(linkSkill.id)}</p>

            {linkError && <div className="mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4 flex-shrink-0" /> {linkError}</div>}

            {linkLoading ? (
              <p className="py-8 text-center text-gray-500 text-sm">Loading employees…</p>
            ) : employees.length === 0 ? (
              <p className="py-8 text-center text-gray-500 text-sm">
                No employees yet. Add them under <Link href="/dashboard/employees" className="text-blue-600 hover:underline">People → Employees</Link> first.
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-md">
                {employees.map((e) => {
                  const has = (empSkillMap[e.id] ?? []).some((s) => s.skillId === linkSkill.id);
                  const busy = togglingId === e.id;
                  return (
                    <label key={e.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${busy ? "opacity-60" : ""}`}>
                      <input
                        type="checkbox"
                        checked={has}
                        disabled={busy || togglingId !== null}
                        onChange={() => toggleEmployee(e)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="flex-1">
                        <span className="text-sm font-medium text-gray-900">{e.name}</span>
                        <span className="ml-2 text-xs text-gray-400">#{e.employeeId}{e.department ? ` · ${e.department}` : ""}</span>
                      </span>
                      {busy && <span className="text-xs text-gray-400">saving…</span>}
                    </label>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end mt-5">
              <button onClick={closeLink} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
