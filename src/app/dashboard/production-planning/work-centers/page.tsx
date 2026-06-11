"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Factory, X, AlertCircle, Settings2, Trash2 } from "lucide-react";

interface Workspace { id: string; name: string }
interface WorkCenter { id: string; name: string; code: string | null; type: string; department: string | null; location: string | null; capacityHoursPerDay: number; isActive: boolean }
interface Machine { id?: string; assetId?: string | null; name: string; capacityPct: number; setupMinutes: number }
interface Shift { id?: string; dayOfWeek: number; startTime: string; endTime: string; breakMinutes: number }

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const emptyWc = { name: "", code: "", type: "machine", department: "", location: "", capacityHoursPerDay: "8" };

export default function WorkCentersPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [centers, setCenters] = useState<WorkCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyWc);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<WorkCenter | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const r = await fetch(`/api/work-centers?workspaceId=${workspaceId}`).then((x) => x.json());
    setCenters(r.data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.name) { setError("Name required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/work-centers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      workspaceId, name: form.name, code: form.code || undefined, type: form.type, department: form.department || undefined,
      location: form.location || undefined, capacityHoursPerDay: Number(form.capacityHoursPerDay) || 8,
    }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm(emptyWc); load();
  };

  const openEdit = async (wc: WorkCenter) => {
    setEditing(wc);
    const full = await fetch(`/api/work-centers/${wc.id}`).then((r) => r.json());
    setMachines(full?.machines ?? []);
    setShifts(full?.shifts ?? []);
  };

  const saveResources = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/work-centers/${editing.id}/machines`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ machines: machines.map((m) => ({ name: m.name, capacityPct: Number(m.capacityPct) || 100, setupMinutes: Number(m.setupMinutes) || 0 })) }) });
    await fetch(`/api/work-centers/${editing.id}/shifts`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ shifts: shifts.map((s) => ({ dayOfWeek: s.dayOfWeek, startTime: s.startTime, endTime: s.endTime, breakMinutes: Number(s.breakMinutes) || 0 })) }) });
    setSaving(false); setEditing(null);
  };

  const del = async (wc: WorkCenter) => {
    if (!confirm(`Delete work center "${wc.name}"?`)) return;
    await fetch(`/api/work-centers/${wc.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Factory className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Work Centers</h1>
        </div>
        <button onClick={() => { setForm(emptyWc); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Work Center
        </button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium text-right">Capacity (h/day)</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : centers.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No work centers yet.</td></tr>
            ) : centers.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900 font-medium">{c.name}{c.code ? <span className="ml-2 text-xs text-gray-400 font-mono">{c.code}</span> : null}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{c.type}</td>
                <td className="px-4 py-3 text-gray-600">{c.department || "—"}</td>
                <td className="px-4 py-3 text-right text-gray-600">{c.capacityHoursPerDay}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-blue-600 mr-3" title="Machines & shifts"><Settings2 className="h-4 w-4 inline" /></button>
                  <button onClick={() => del(c)} className="text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4 inline" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Work Center</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Name *</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Code</span>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
                <label className="block"><span className="text-xs text-gray-500">Type</span>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                    <option value="machine">Machine</option><option value="manual">Manual</option><option value="hybrid">Hybrid</option>
                  </select></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Department</span>
                  <input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
                <label className="block"><span className="text-xs text-gray-500">Capacity (h/day)</span>
                  <input type="number" value={form.capacityHoursPerDay} onChange={(e) => setForm({ ...form, capacityHoursPerDay: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              </div>
              <label className="block"><span className="text-xs text-gray-500">Location</span>
                <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editing.name} — Machines & Shifts</h2>
              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-medium text-gray-700">Machines</h3>
                <button onClick={() => setMachines([...machines, { name: "", capacityPct: 100, setupMinutes: 0 }])} className="text-xs text-blue-600 hover:underline">+ Add machine</button></div>
              {machines.length === 0 && <p className="text-xs text-gray-400">No machines.</p>}
              {machines.map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <input placeholder="Machine name" value={m.name} onChange={(e) => { const x = [...machines]; x[i] = { ...m, name: e.target.value }; setMachines(x); }} className="col-span-6 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
                  <input type="number" placeholder="Cap %" value={m.capacityPct} onChange={(e) => { const x = [...machines]; x[i] = { ...m, capacityPct: Number(e.target.value) }; setMachines(x); }} className="col-span-2 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
                  <input type="number" placeholder="Setup min" value={m.setupMinutes} onChange={(e) => { const x = [...machines]; x[i] = { ...m, setupMinutes: Number(e.target.value) }; setMachines(x); }} className="col-span-3 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
                  <button onClick={() => setMachines(machines.filter((_, j) => j !== i))} className="col-span-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-medium text-gray-700">Shift Calendar</h3>
                <button onClick={() => setShifts([...shifts, { dayOfWeek: 1, startTime: "08:00", endTime: "17:00", breakMinutes: 0 }])} className="text-xs text-blue-600 hover:underline">+ Add shift</button></div>
              {shifts.length === 0 && <p className="text-xs text-gray-400">No shifts — defaults to 8h/day Mon–Fri.</p>}
              {shifts.map((s, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                  <select value={s.dayOfWeek} onChange={(e) => { const x = [...shifts]; x[i] = { ...s, dayOfWeek: Number(e.target.value) }; setShifts(x); }} className="col-span-3 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                    {DAYS.map((d, j) => <option key={j} value={j}>{d}</option>)}
                  </select>
                  <input type="time" value={s.startTime} onChange={(e) => { const x = [...shifts]; x[i] = { ...s, startTime: e.target.value }; setShifts(x); }} className="col-span-3 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
                  <input type="time" value={s.endTime} onChange={(e) => { const x = [...shifts]; x[i] = { ...s, endTime: e.target.value }; setShifts(x); }} className="col-span-3 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
                  <input type="number" placeholder="Break" value={s.breakMinutes} onChange={(e) => { const x = [...shifts]; x[i] = { ...s, breakMinutes: Number(e.target.value) }; setShifts(x); }} className="col-span-2 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
                  <button onClick={() => setShifts(shifts.filter((_, j) => j !== i))} className="col-span-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={saveResources} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
