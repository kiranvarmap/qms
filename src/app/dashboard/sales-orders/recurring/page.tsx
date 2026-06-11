"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Repeat, Plus, X, Play } from "lucide-react";

interface Workspace { id: string; name: string }
interface Customer { id: string; name: string }
interface RO { id: string; name: string; cadence: string; customerId: string; isActive: boolean; nextRunDate: string | null; }

export default function RecurringOrdersPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [ros, setRos] = useState<RO[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ customerId: "", name: "", cadence: "monthly" });
  const [saving, setSaving] = useState(false);

  const cName = (id: string) => customers.find((c) => c.id === id)?.name ?? "—";

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [ro, cu] = await Promise.all([
      fetch(`/api/recurring-orders?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/customers?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setRos(ro.data ?? []); setCustomers(cu.data ?? []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.customerId || !form.name.trim()) return;
    setSaving(true);
    await fetch("/api/recurring-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, customerId: form.customerId, name: form.name.trim(), cadence: form.cadence, lines: [] }) });
    setSaving(false); setShow(false); setForm({ customerId: "", name: "", cadence: "monthly" }); load();
  };
  const generate = async (id: string) => { const res = await fetch(`/api/recurring-orders/${id}/generate`, { method: "POST" }); const data = await res.json().catch(() => ({})); if (res.ok && data.salesOrderId) alert("Draft sales order generated."); load(); };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/sales-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Sales Orders</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><Repeat className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Recurring Orders</h1></div>
        <button onClick={() => setShow(true)} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Recurring</button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Cadence</th><th className="px-4 py-3 font-medium">Next run</th><th className="px-4 py-3 font-medium text-right">Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : ros.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No recurring orders.</td></tr>
            : ros.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900">{r.name}</td>
                <td className="px-4 py-3 text-gray-600">{cName(r.customerId)}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{r.cadence}</td>
                <td className="px-4 py-3 text-gray-600">{r.nextRunDate ? new Date(r.nextRunDate).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-right"><button onClick={() => generate(r.id)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><Play className="h-3.5 w-3.5" /> Generate now</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Recurring Order</h2><button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <label className="block"><span className="text-xs text-gray-500">Customer</span><select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">Select…</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label className="block"><span className="text-xs text-gray-500">Cadence</span><select value={form.cadence} onChange={(e) => setForm({ ...form, cadence: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></label>
              <p className="text-xs text-gray-500">Template lines can be added on the generated draft order.</p>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShow(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
