"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldX, Check } from "lucide-react";

interface Workspace { id: string; name: string }
interface Product { id: string; name: string; sku: string | null }
interface Warehouse { id: string; name: string }

export default function StockStatusPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState({ productId: "", warehouseId: "", move: "damage", quantity: "1", note: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const [pr, wh] = await Promise.all([
      fetch(`/api/products?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/warehouses?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setProducts(pr.data ?? []);
    setWarehouses(wh.data ?? wh ?? []);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const submit = async () => {
    if (!form.productId || !form.warehouseId) { setMsg("Pick product and warehouse"); return; }
    setBusy(true); setMsg("");
    const res = await fetch("/api/inventory/stock-status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      workspaceId, productId: form.productId, warehouseId: form.warehouseId, move: form.move, quantity: Number(form.quantity) || 0, note: form.note.trim() || undefined,
    }) });
    setBusy(false);
    if (res.ok) { setMsg("Done"); setForm({ ...form, quantity: "1", note: "" }); }
    else { const e = await res.json().catch(() => ({})); setMsg(e.error || "Failed"); }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
      <div className="flex items-center gap-3 mb-6"><ShieldX className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Damaged / Quarantine / Scrap</h1></div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm space-y-3">
        <label className="block"><span className="text-xs text-gray-500">Action</span>
          <select value={form.move} onChange={(e) => setForm({ ...form, move: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
            <option value="damage">Mark damaged (on-hand → damaged)</option>
            <option value="quarantine">Quarantine (on-hand → quarantine)</option>
            <option value="quarantine_release">Release quarantine (→ on-hand)</option>
            <option value="scrap">Scrap (remove from stock)</option>
          </select>
        </label>
        <label className="block"><span className="text-xs text-gray-500">Product</span>
          <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
            <option value="">Select…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="text-xs text-gray-500">Warehouse</span>
            <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
              <option value="">Select…</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <label className="block"><span className="text-xs text-gray-500">Quantity</span>
            <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
          </label>
        </div>
        <label className="block"><span className="text-xs text-gray-500">Note</span>
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
        </label>
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-gray-500">{msg === "Done" ? <span className="text-green-700 inline-flex items-center gap-1"><Check className="h-4 w-4" /> Done</span> : msg}</span>
          <button onClick={submit} disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{busy ? "Working…" : "Apply"}</button>
        </div>
      </div>
    </div>
  );
}
