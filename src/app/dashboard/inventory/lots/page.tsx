"use client";

import { NativeSelect, DateInput } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Item as Boxes, Add as Plus, CloseSmall as X } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Product { id: string; name: string; sku: string | null; tracksLots?: boolean }
interface Lot { id: string; lotNumber: string; supplierLotNumber: string | null; expiryDate: string | null; status: string; }

const statusBadge: Record<string, string> = { available: "bg-green-100 text-green-700", quarantine: "bg-amber-100 text-amber-700", expired: "bg-red-100 text-red-700", scrapped: "bg-gray-100 text-gray-500" };

export default function LotsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [lots, setLots] = useState<Lot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ lotNumber: "", supplierLotNumber: "", mfgDate: "", expiryDate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    fetch(`/api/products?workspaceId=${workspaceId}`).then((r) => r.json()).then((d) => setProducts(d.data ?? [])).catch(() => setProducts([]));
  }, [workspaceId]);

  const load = useCallback(async () => {
    if (!productId) { setLots([]); setLoading(false); return; }
    setLoading(true);
    const res = await fetch(`/api/products/${productId}/lots`);
    const data = await res.json();
    setLots(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!productId || !form.lotNumber.trim()) return;
    setSaving(true);
    await fetch(`/api/products/${productId}/lots`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      lotNumber: form.lotNumber.trim(), supplierLotNumber: form.supplierLotNumber.trim() || undefined,
      mfgDate: form.mfgDate ? new Date(form.mfgDate).toISOString() : undefined,
      expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString() : undefined,
    }) });
    setSaving(false); setShowCreate(false); setForm({ lotNumber: "", supplierLotNumber: "", mfgDate: "", expiryDate: "" }); load();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><Boxes className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Lots / Batches</h1></div>
        <button onClick={() => setShowCreate(true)} disabled={!productId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Lot</button>
      </div>

      <div className="flex gap-2 mb-4">
        <NativeSelect value={workspaceId} onChange={(e) => { setWorkspaceId(e.target.value); setProductId(""); }} className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </NativeSelect>
        <NativeSelect value={productId} onChange={(e) => setProductId(e.target.value)} className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
          <option value="">Select product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
        </NativeSelect>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium">Lot #</th><th className="px-4 py-3 font-medium">Supplier lot</th><th className="px-4 py-3 font-medium">Expiry (FEFO)</th><th className="px-4 py-3 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {!productId ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Select a product.</td></tr>
            : loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : lots.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No lots yet.</td></tr>
            : lots.map((l) => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900 font-mono text-xs">{l.lotNumber}</td>
                <td className="px-4 py-3 text-gray-600">{l.supplierLotNumber || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{l.expiryDate ? new Date(l.expiryDate).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[l.status] || "bg-gray-100 text-gray-700"}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Lot</h2><button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Lot number</span><input value={form.lotNumber} onChange={(e) => setForm({ ...form, lotNumber: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <label className="block"><span className="text-xs text-gray-500">Supplier lot number</span><input value={form.supplierLotNumber} onChange={(e) => setForm({ ...form, supplierLotNumber: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Mfg date</span><DateInput value={form.mfgDate} onChange={(e) => setForm({ ...form, mfgDate: e.target.value })} className="mt-1 w-full" /></label>
                <label className="block"><span className="text-xs text-gray-500">Expiry date</span><DateInput value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="mt-1 w-full" /></label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
