"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, FileMinus, Plus, X } from "lucide-react";

interface Workspace { id: string; name: string }
interface Vendor { id: string; name: string }
interface Bill { id: string; docNumber: string; status: string; vendorId: string | null; totalMinor: number; amountPaidMinor: number; }

const statusBadge: Record<string, string> = { draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", partially_paid: "bg-amber-100 text-amber-700", paid: "bg-green-100 text-green-700", overdue: "bg-red-100 text-red-700", void: "bg-gray-100 text-gray-400" };

export default function ApBillsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ vendorId: "", dueDate: "" });
  const [lines, setLines] = useState([{ description: "", quantity: "1", unitPrice: "" }]);
  const [saving, setSaving] = useState(false);

  const vName = (id: string | null) => vendors.find((v) => v.id === id)?.name ?? "—";

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [bl, vn] = await Promise.all([
      fetch(`/api/ap-bills?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/vendors?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setBills(bl.data ?? []); setVendors(vn.data ?? []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.vendorId) return;
    setSaving(true);
    const payloadLines = lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 1, unitPrice: Number(l.unitPrice) || 0 }));
    await fetch("/api/ap-bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, vendorId: form.vendorId, dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined, lines: payloadLines }) });
    setSaving(false); setShow(false); setForm({ vendorId: "", dueDate: "" }); setLines([{ description: "", quantity: "1", unitPrice: "" }]); load();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/invoices" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Invoices</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><FileMinus className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">AP Bills (Payables)</h1></div>
        <button onClick={() => setShow(true)} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Bill</button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Bill #</th><th className="px-4 py-3 font-medium">Vendor</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium text-right">Total</th><th className="px-4 py-3 font-medium text-right">Balance</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : bills.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No bills yet.</td></tr>
            : bills.map((b) => (
              <tr key={b.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{b.docNumber}</td>
                <td className="px-4 py-3 text-gray-900">{vName(b.vendorId)}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[b.status]}`}>{b.status.replace("_", " ")}</span></td>
                <td className="px-4 py-3 text-right text-gray-900">{(b.totalMinor / 100).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{((b.totalMinor - b.amountPaidMinor) / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New AP Bill</h2><button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Vendor</span><select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">Select…</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></label>
                <label className="block"><span className="text-xs text-gray-500">Due date</span><input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              </div>
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                  <input type="number" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} placeholder="Qty" className="w-16 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                  <input type="number" value={l.unitPrice} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unitPrice: e.target.value } : x))} placeholder="Price" className="w-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                </div>
              ))}
              <button onClick={() => setLines([...lines, { description: "", quantity: "1", unitPrice: "" }])} className="text-sm text-gray-600 hover:text-gray-900">+ line</button>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShow(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
