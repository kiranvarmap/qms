"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, Plus, X } from "lucide-react";

interface Workspace { id: string; name: string }
interface Vendor { id: string; name: string }
interface Req { id: string; docNumber: string; status: string; vendorId: string | null; }

const statusBadge: Record<string, string> = { draft: "bg-gray-100 text-gray-700", submitted: "bg-blue-100 text-blue-700", approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700", converted: "bg-violet-100 text-violet-700" };

export default function RequisitionsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ vendorId: "", notes: "", submit: true });
  const [lines, setLines] = useState([{ description: "", quantity: "1", estUnitCost: "" }]);
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
    const [rq, vn] = await Promise.all([
      fetch(`/api/requisitions?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/vendors?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setReqs(rq.data ?? []);
    setVendors(vn.data ?? []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    setSaving(true);
    const payloadLines = lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 1, estUnitCost: Number(l.estUnitCost) || 0 }));
    await fetch("/api/requisitions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, vendorId: form.vendorId || undefined, notes: form.notes.trim() || undefined, submit: form.submit, lines: payloadLines }) });
    setSaving(false); setShow(false); setForm({ vendorId: "", notes: "", submit: true }); setLines([{ description: "", quantity: "1", estUnitCost: "" }]); load();
  };
  const decide = async (id: string, decision: string) => { await fetch(`/api/requisitions/${id}/decide`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision }) }); load(); };
  const convert = async (id: string) => { const res = await fetch(`/api/requisitions/${id}/convert`, { method: "POST" }); if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || "Failed"); } load(); };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/purchase-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Purchase Orders</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><ClipboardList className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Purchase Requisitions</h1></div>
        <button onClick={() => setShow(true)} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Requisition</button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Number</th><th className="px-4 py-3 font-medium">Vendor</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium text-right">Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : reqs.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No requisitions yet.</td></tr>
            : reqs.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.docNumber}</td>
                <td className="px-4 py-3 text-gray-900">{vName(r.vendorId)}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status]}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-right">
                  {r.status === "submitted" && <span className="inline-flex gap-2"><button onClick={() => decide(r.id, "approved")} className="text-xs text-green-700 hover:underline">Approve</button><button onClick={() => decide(r.id, "rejected")} className="text-xs text-red-600 hover:underline">Reject</button></span>}
                  {r.status === "approved" && <button onClick={() => convert(r.id)} className="text-xs text-blue-600 hover:underline">Convert to PO</button>}
                  {(r.status === "draft" || r.status === "rejected" || r.status === "converted") && <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Requisition</h2><button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Vendor (needed to convert later)</span>
                <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">—</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
              </label>
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <input value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Item" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                  <input type="number" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} placeholder="Qty" className="w-20 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                  <input type="number" value={l.estUnitCost} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, estUnitCost: e.target.value } : x))} placeholder="Est cost" className="w-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                </div>
              ))}
              <button onClick={() => setLines([...lines, { description: "", quantity: "1", estUnitCost: "" }])} className="text-sm text-gray-600 hover:text-gray-900">+ line</button>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.submit} onChange={(e) => setForm({ ...form, submit: e.target.checked })} /> Submit for approval</label>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShow(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
