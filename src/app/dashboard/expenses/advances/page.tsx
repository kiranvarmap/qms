"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, Plus, X } from "lucide-react";

interface Workspace { id: string; name: string }
interface Employee { id: string; name?: string; fullName?: string; firstName?: string }
interface Adv { id: string; docNumber: string; employeeId: string; amountMinor: number; settledMinor: number; status: string; }

const statusBadge: Record<string, string> = { requested: "bg-blue-100 text-blue-700", approved: "bg-amber-100 text-amber-700", settled: "bg-green-100 text-green-700" };

export default function AdvancesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [advances, setAdvances] = useState<Adv[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ employeeId: "", amount: "", note: "" });
  const [saving, setSaving] = useState(false);

  const empName = (id: string) => { const e = employees.find((x) => x.id === id); return e?.name || e?.fullName || e?.firstName || "—"; };

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [ad, em] = await Promise.all([
      fetch(`/api/expense-advances?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/employees?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({ data: [] })),
    ]);
    setAdvances(ad.data ?? []);
    setEmployees(em.data ?? em ?? []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.employeeId || !form.amount) return;
    setSaving(true);
    await fetch("/api/expense-advances", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, employeeId: form.employeeId, amount: Number(form.amount), note: form.note.trim() || undefined }) });
    setSaving(false); setShow(false); setForm({ employeeId: "", amount: "", note: "" }); load();
  };
  const decide = async (id: string, decision: string) => { await fetch(`/api/expense-advances/${id}/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) }); load(); };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/expenses" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Expenses</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><Banknote className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Cash Advances</h1></div>
        <button onClick={() => setShow(true)} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Advance</button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Number</th><th className="px-4 py-3 font-medium">Employee</th><th className="px-4 py-3 font-medium text-right">Amount</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium text-right">Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : advances.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No advances yet.</td></tr>
            : advances.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.docNumber}</td>
                <td className="px-4 py-3 text-gray-900">{empName(a.employeeId)}</td>
                <td className="px-4 py-3 text-right text-gray-900">{(a.amountMinor / 100).toFixed(2)}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[a.status] || "bg-gray-100 text-gray-700"}`}>{a.status}</span></td>
                <td className="px-4 py-3 text-right">
                  {a.status === "requested" && <button onClick={() => decide(a.id, "approved")} className="text-xs text-green-700 hover:underline">Approve</button>}
                  {a.status === "approved" && <button onClick={() => decide(a.id, "settled")} className="text-xs text-blue-600 hover:underline">Mark settled</button>}
                  {a.status === "settled" && <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Cash Advance</h2><button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Employee</span><select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">Select…</option>{employees.map((e) => <option key={e.id} value={e.id}>{empName(e.id)}</option>)}</select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Amount</span><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
                <label className="block"><span className="text-xs text-gray-500">Note</span><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShow(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
