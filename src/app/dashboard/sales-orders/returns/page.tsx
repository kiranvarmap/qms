"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Undo2, Plus, X } from "lucide-react";

interface Workspace { id: string; name: string }
interface Customer { id: string; name: string }
interface Warehouse { id: string; name: string }
interface Product { id: string; name: string }
interface Ret { id: string; docNumber: string; status: string; customerId: string | null; reason: string | null; restock: boolean; }

const statusBadge: Record<string, string> = { draft: "bg-gray-100 text-gray-700", posted: "bg-green-100 text-green-700", cancelled: "bg-red-100 text-red-700" };

export default function SalesReturnsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [rets, setRets] = useState<Ret[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ customerId: "", warehouseId: "", reason: "", restock: true });
  const [lines, setLines] = useState([{ productId: "", quantity: "1" }]);
  const [saving, setSaving] = useState(false);

  const cName = (id: string | null) => customers.find((c) => c.id === id)?.name ?? "—";

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [rt, cu, wh, pr] = await Promise.all([
      fetch(`/api/sales-returns?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/customers?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/warehouses?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/products?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setRets(rt.data ?? []); setCustomers(cu.data ?? []); setWarehouses(wh.data ?? wh ?? []); setProducts(pr.data ?? []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    setSaving(true);
    const payloadLines = lines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) || 1 }));
    await fetch("/api/sales-returns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, customerId: form.customerId || undefined, warehouseId: form.warehouseId || undefined, reason: form.reason.trim() || undefined, restock: form.restock, lines: payloadLines }) });
    setSaving(false); setShow(false); setForm({ customerId: "", warehouseId: "", reason: "", restock: true }); setLines([{ productId: "", quantity: "1" }]); load();
  };
  const post = async (id: string) => { const res = await fetch(`/api/sales-returns/${id}/post`, { method: "POST" }); if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || "Failed"); } load(); };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/sales-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Sales Orders</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><Undo2 className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Returns / RMA</h1></div>
        <button onClick={() => setShow(true)} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New RMA</button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Number</th><th className="px-4 py-3 font-medium">Customer</th><th className="px-4 py-3 font-medium">Reason</th><th className="px-4 py-3 font-medium">Restock</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium text-right">Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : rets.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No returns yet.</td></tr>
            : rets.map((r) => (
              <tr key={r.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.docNumber}</td>
                <td className="px-4 py-3 text-gray-900">{cName(r.customerId)}</td>
                <td className="px-4 py-3 text-gray-600">{r.reason || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{r.restock ? "Yes" : "No"}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status]}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-right">{r.status === "draft" ? <button onClick={() => post(r.id)} className="text-xs text-green-700 hover:underline">Post{r.restock ? " (restock)" : ""}</button> : <span className="text-gray-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-lg p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New RMA</h2><button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Customer</span><select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">—</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
                <label className="block"><span className="text-xs text-gray-500">Restock warehouse</span><select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">—</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
              </div>
              <label className="block"><span className="text-xs text-gray-500">Reason</span><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <select value={l.productId} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, productId: e.target.value } : x))} className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">Product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  <input type="number" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} placeholder="Qty" className="w-20 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                </div>
              ))}
              <button onClick={() => setLines([...lines, { productId: "", quantity: "1" }])} className="text-sm text-gray-600 hover:text-gray-900">+ line</button>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.restock} onChange={(e) => setForm({ ...form, restock: e.target.checked })} /> Restock on post</label>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShow(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
