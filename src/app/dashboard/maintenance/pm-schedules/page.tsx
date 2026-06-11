"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, CalendarClock, X, AlertCircle, ArrowLeft } from "lucide-react";

interface Workspace { id: string; name: string }
interface Asset { id: string; name: string; code: string | null }
interface PmSchedule {
  id: string;
  assetId: string;
  assetName: string | null;
  assetCode: string | null;
  name: string;
  intervalDays: number;
  checklist: string | null;
  nextDue: string | null;
  isActive: boolean;
}

const empty = { assetId: "", name: "", intervalDays: "30", nextDue: "", checklist: "" };

export default function PmSchedulesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [schedules, setSchedules] = useState<PmSchedule[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
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
    const [schedRes, assetRes] = await Promise.all([
      fetch(`/api/pm-schedules?workspaceId=${workspaceId}`),
      fetch(`/api/assets?workspaceId=${workspaceId}`),
    ]);
    const schedData = await schedRes.json();
    const assetData = await assetRes.json();
    setSchedules(schedRes.ok && Array.isArray(schedData.data) ? schedData.data : []);
    setAssets(assetRes.ok && Array.isArray(assetData.data) ? assetData.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.assetId) { setError("Pick an asset"); return; }
    if (!form.name.trim()) { setError("Name is required"); return; }
    if (!form.nextDue) { setError("First due date is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/pm-schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        assetId: form.assetId,
        name: form.name.trim(),
        intervalDays: Number(form.intervalDays) || 0,
        nextDue: new Date(form.nextDue).toISOString(),
        checklist: form.checklist.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm(empty); load();
  };

  const toggleActive = async (s: PmSchedule) => {
    await fetch(`/api/pm-schedules/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    load();
  };

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");
  const overdue = (s: PmSchedule) => s.isActive && s.nextDue && new Date(s.nextDue) < new Date();

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/dashboard/maintenance" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Maintenance</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Preventive Maintenance</h1>
            <p className="text-sm text-gray-500">Schedules generate maintenance orders automatically when due.</p>
          </div>
        </div>
        <button onClick={() => { setForm(empty); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Schedule
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
              <th className="px-4 py-3 font-medium">Asset</th>
              <th className="px-4 py-3 font-medium">Schedule</th>
              <th className="px-4 py-3 font-medium">Every</th>
              <th className="px-4 py-3 font-medium">Next due</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : schedules.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No PM schedules yet. Create one and the cron generates orders when due.</td></tr>
            ) : schedules.map((s) => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900">{s.assetName ?? "—"}{s.assetCode ? <span className="ml-1.5 text-xs text-gray-400 font-mono">{s.assetCode}</span> : null}</td>
                <td className="px-4 py-3 text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">{s.intervalDays > 0 ? `${s.intervalDays}d` : "one-shot"}</td>
                <td className={`px-4 py-3 ${overdue(s) ? "text-red-600 font-medium" : "text-gray-600"}`}>{fmt(s.nextDue)}{overdue(s) ? " (due)" : ""}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {s.isActive ? "active" : "paused"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => toggleActive(s)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                    {s.isActive ? "Pause" : "Resume"}
                  </button>
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
              <h2 className="text-lg font-semibold text-gray-900">New PM Schedule</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-gray-500">Asset *</span>
                <select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="">Select asset…</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.name}{a.code ? ` (${a.code})` : ""}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Schedule name *</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Monthly lubrication" className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-500">Repeat every (days, 0 = once)</span>
                  <input type="number" min={0} value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">First due *</span>
                  <input type="date" value={form.nextDue} onChange={(e) => setForm({ ...form, nextDue: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-gray-500">Checklist (one task per line)</span>
                <textarea value={form.checklist} onChange={(e) => setForm({ ...form, checklist: e.target.value })} rows={3} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
              </label>
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
