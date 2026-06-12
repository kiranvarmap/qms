"use client";

import { NativeSelect, DateInput } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Event as CalendarDays, Add as Plus, CloseSmall as X, Alert as AlertCircle, Group as Users } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface LeaveType { id: string; name: string }
interface LeaveRequest {
  id: string; status: string; startDate: string; endDate: string; days: number;
  reason: string | null; employeeName: string | null; leaveTypeName: string | null;
}
interface Balance { id: string; leaveTypeName: string | null; entitledDays: number; takenDays: number; remainingDays: number }

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600",
  approved: "bg-green-500/20 text-green-600",
  rejected: "bg-red-500/20 text-red-600",
  cancelled: "bg-gray-600/40 text-gray-600",
};

function daysBetween(a: string, b: string) {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export default function LeavePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ leaveTypeId: "", startDate: "", endDate: "", reason: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((data: Workspace[]) => {
      setWorkspaces(Array.isArray(data) ? data : []);
      if (Array.isArray(data) && data.length > 0) setWorkspaceId(data[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [r, t, b] = await Promise.all([
      fetch(`/api/leave-requests?workspaceId=${workspaceId}&mine=true`).then((x) => x.json()).catch(() => ({})),
      fetch(`/api/leave-types?workspaceId=${workspaceId}`).then((x) => x.json()).catch(() => ({})),
      fetch(`/api/leave-balances?workspaceId=${workspaceId}&year=${new Date().getFullYear()}`).then((x) => x.json()).catch(() => ({})),
    ]);
    setRequests(Array.isArray(r.data) ? r.data : []);
    setLeaveTypes(Array.isArray(t.data) ? t.data : []);
    setBalances(Array.isArray(b.data) ? b.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const submit = async () => {
    if (!form.leaveTypeId || !form.startDate || !form.endDate) { setError("Type and dates are required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/leave-requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId, leaveTypeId: form.leaveTypeId,
        startDate: new Date(form.startDate).toISOString(),
        endDate: new Date(form.endDate).toISOString(),
        days: daysBetween(form.startDate, form.endDate),
        reason: form.reason.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm({ leaveTypeId: "", startDate: "", endDate: "", reason: "" }); load();
  };

  const cancel = async (id: string) => {
    await fetch(`/api/leave-requests/${id}/cancel`, { method: "POST" });
    load();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><CalendarDays className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Leave</h1></div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/hr" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-700 hover:text-gray-900 border border-gray-200 rounded-md"><Users className="h-4 w-4" /> Directory</Link>
          <button onClick={() => { setError(""); setShowCreate(true); }} disabled={!workspaceId} className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> Request Leave</button>
        </div>
      </div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      {balances.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {balances.map((b) => (
            <div key={b.id} className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="text-xs text-gray-500">{b.leaveTypeName}</div>
              <div className="text-[24px] font-semibold tracking-tight text-gray-900 [font-family:var(--font-display)] mt-1">{b.remainingDays}<span className="text-sm text-gray-500"> / {b.entitledDays} left</span></div>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-700 mb-2">My requests</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Dates</th>
            <th className="px-4 py-3 font-medium text-right">Days</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right"></th>
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No leave requests.</td></tr>
            ) : requests.map((r) => (
              <tr key={r.id} className="border-b border-gray-200">
                <td className="px-4 py-3 text-gray-900">{r.leaveTypeName ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right text-gray-700">{r.days}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status] ?? ""}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-right">{r.status === "pending" && <button onClick={() => cancel(r.id)} className="text-xs text-gray-500 hover:text-red-600">Cancel</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">Request Leave</h2><button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-500/10 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Leave type</span>
                <NativeSelect value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">Select…</option>{leaveTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">From</span><DateInput value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1 w-full" /></label>
                <label className="block"><span className="text-xs text-gray-500">To</span><DateInput value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1 w-full" /></label>
              </div>
              {form.startDate && form.endDate && <p className="text-xs text-gray-500">{daysBetween(form.startDate, form.endDate)} day(s)</p>}
              <label className="block"><span className="text-xs text-gray-500">Reason</span><textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={2} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={submit} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Submitting…" : "Submit"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
