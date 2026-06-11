"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Factory, X, AlertCircle } from "lucide-react";

interface Workspace { id: string; name: string }
interface Product { id: string; name: string; sku: string | null }
interface Bom { id: string; version: string; name: string | null }
interface Warehouse { id: string; name: string }
interface WorkOrder { id: string; number: string; productId: string; qtyPlanned: number; qtyProduced: number; status: string; }

const empty = { productId: "", bomId: "", warehouseId: "", qtyPlanned: "1", dueDate: "" };

const statusBadge: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  released: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function ProductionPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [wo, pr, wh] = await Promise.all([
      fetch(`/api/work-orders?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/products?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/warehouses?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setOrders(wo.data ?? []);
    setProducts(pr.data ?? []);
    setWarehouses(wh.data ?? wh ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  // When a product is chosen, load its BOMs for the dropdown.
  useEffect(() => {
    if (!form.productId) { setBoms([]); return; }
    fetch(`/api/products/${form.productId}/engineering`).then((r) => r.json()).then((e) => setBoms(e.boms ?? [])).catch(() => setBoms([]));
  }, [form.productId]);

  const create = async () => {
    if (!form.productId) { setError("Pick a product"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/work-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      workspaceId,
      productId: form.productId,
      bomId: form.bomId || undefined,
      warehouseId: form.warehouseId || undefined,
      qtyPlanned: Number(form.qtyPlanned) || 1,
      dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
    }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm(empty); load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Factory className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Production</h1>
        </div>
        <button onClick={() => { setForm(empty); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Work Order
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
              <th className="px-4 py-3 font-medium">Work Order</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium text-right">Planned</th>
              <th className="px-4 py-3 font-medium text-right">Produced</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No work orders yet.</td></tr>
            ) : orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3"><Link href={`/dashboard/production/${o.id}`} className="text-blue-600 hover:underline font-mono text-xs">{o.number}</Link></td>
                <td className="px-4 py-3 text-gray-900">{productName(o.productId)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{o.qtyPlanned}</td>
                <td className="px-4 py-3 text-right text-gray-600">{o.qtyProduced}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[o.status] || "bg-gray-100 text-gray-700"}`}>{o.status.replace("_", " ")}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Work Order</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-gray-500">Product *</span>
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, bomId: "" })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="">Select…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">BOM (optional — explodes into materials)</span>
                <select value={form.bomId} onChange={(e) => setForm({ ...form, bomId: e.target.value })} disabled={!form.productId} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 disabled:opacity-50">
                  <option value="">None</option>
                  {boms.map((b) => <option key={b.id} value={b.id}>{b.version}{b.name ? ` — ${b.name}` : ""}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-500">Qty planned</span>
                  <input type="number" value={form.qtyPlanned} onChange={(e) => setForm({ ...form, qtyPlanned: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Due date</span>
                  <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-gray-500">Warehouse (components / finished goods)</span>
                <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="">Default</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
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
