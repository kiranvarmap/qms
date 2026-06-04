"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Boxes, Warehouse as WarehouseIcon, SlidersHorizontal, X, AlertCircle, AlertTriangle } from "lucide-react";

interface Workspace { id: string; name: string }
interface Warehouse { id: string; name: string }
interface Product {
  id: string;
  sku: string | null;
  name: string;
  type: "good" | "service";
  category: string | null;
  unit: string;
  priceMinor: number;
  reorderLevel: number;
  trackInventory: boolean;
  isActive: boolean;
  onHand: number;
  committed: number;
  available: number;
}

function money(minor: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
}

const emptyForm = { name: "", sku: "", type: "good", category: "", unit: "unit", cost: "0", price: "0", reorderLevel: "0" };

export default function InventoryPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [adjust, setAdjust] = useState<Product | null>(null);
  const [adjustForm, setAdjustForm] = useState({ warehouseId: "", quantity: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data: Workspace[]) => {
        setWorkspaces(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setWorkspaceId(data[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [p, w] = await Promise.all([
      fetch(`/api/products?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/warehouses?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
    ]);
    setProducts(Array.isArray(p.data) ? p.data : []);
    setWarehouses(Array.isArray(w.data) ? w.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const createProduct = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        type: form.type,
        category: form.category.trim() || undefined,
        unit: form.unit.trim() || undefined,
        cost: Number(form.cost) || 0,
        price: Number(form.price) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
      }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm(emptyForm); load();
  };

  const openAdjust = (p: Product) => {
    setAdjust(p);
    setAdjustForm({ warehouseId: warehouses[0]?.id ?? "", quantity: "", note: "" });
    setError("");
  };

  const submitAdjust = async () => {
    if (!adjust) return;
    if (!adjustForm.warehouseId) { setError("Select a warehouse"); return; }
    const qty = Number(adjustForm.quantity);
    if (!qty) { setError("Enter a non-zero quantity"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/inventory/adjustments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, productId: adjust.id, warehouseId: adjustForm.warehouseId, quantity: qty, note: adjustForm.note.trim() || undefined }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setAdjust(null); load();
  };

  const filtered = products.filter((p) =>
    [p.name, p.sku, p.category].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Boxes className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-semibold text-white">Inventory</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/inventory/warehouses" className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-white border border-white/10 rounded-md">
            <WarehouseIcon className="h-4 w-4" /> Warehouses
          </Link>
          <button onClick={() => { setForm(emptyForm); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">
            <Plus className="h-4 w-4" /> New Product
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="bg-gray-900 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200">
          {workspaces.length === 0 && <option value="">No workspaces</option>}
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…" className="w-full bg-gray-900 border border-white/10 rounded-md pl-9 pr-3 py-2 text-sm text-gray-200 placeholder-gray-500" />
        </div>
      </div>

      {warehouses.length === 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-md px-3 py-2">
          <AlertTriangle className="h-4 w-4" /> No warehouses yet — <Link href="/dashboard/inventory/warehouses" className="underline">create one</Link> to receive and adjust stock.
        </div>
      )}

      <div className="bg-gray-900 border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-white/10">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium text-right">On hand</th>
              <th className="px-4 py-3 font-medium text-right">Committed</th>
              <th className="px-4 py-3 font-medium text-right">Available</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No products yet.</td></tr>
            ) : filtered.map((p) => {
              const low = p.trackInventory && p.reorderLevel > 0 && p.available < p.reorderLevel;
              return (
                <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/inventory/${p.id}`} className="text-blue-400 hover:underline font-medium">{p.name}</Link>
                    {p.type === "service" && <span className="ml-2 text-xs text-gray-500">service</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{p.sku || "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{money(p.priceMinor)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{p.trackInventory ? p.onHand : "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-400">{p.trackInventory ? p.committed : "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {p.trackInventory ? (
                      <span className={low ? "text-amber-400 font-medium inline-flex items-center gap-1" : "text-gray-200"}>
                        {low && <AlertTriangle className="h-3.5 w-3.5" />}{p.available}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.trackInventory && (
                      <button onClick={() => openAdjust(p)} className="p-1.5 text-gray-500 hover:text-gray-200" title="Adjust stock"><SlidersHorizontal className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="New Product" onClose={() => setShowCreate(false)} error={error}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} className="col-span-2" />
            <Field label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
            <label className="block">
              <span className="text-xs text-gray-500">Type</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200">
                <option value="good">Good (tracked)</option>
                <option value="service">Service (not tracked)</option>
              </select>
            </label>
            <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
            <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
            <Field label="Cost" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} type="number" />
            <Field label="Price" value={form.price} onChange={(v) => setForm({ ...form, price: v })} type="number" />
            <Field label="Reorder level" value={form.reorderLevel} onChange={(v) => setForm({ ...form, reorderLevel: v })} type="number" className="col-span-2" />
          </div>
          <ModalActions saving={saving} onCancel={() => setShowCreate(false)} onSave={createProduct} saveLabel="Create" />
        </Modal>
      )}

      {adjust && (
        <Modal title={`Adjust — ${adjust.name}`} onClose={() => setAdjust(null)} error={error}>
          <label className="block mb-3">
            <span className="text-xs text-gray-500">Warehouse</span>
            <select value={adjustForm.warehouseId} onChange={(e) => setAdjustForm({ ...adjustForm, warehouseId: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200">
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </label>
          <Field label="Quantity (+/−)" value={adjustForm.quantity} onChange={(v) => setAdjustForm({ ...adjustForm, quantity: v })} type="number" />
          <div className="mt-3"><Field label="Note" value={adjustForm.note} onChange={(v) => setAdjustForm({ ...adjustForm, note: v })} /></div>
          <ModalActions saving={saving} onCancel={() => setAdjust(null)} onSave={submitAdjust} saveLabel="Apply" />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, error, children }: { title: string; onClose: () => void; error: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-white/10 rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="h-5 w-5" /></button>
        </div>
        {error && (
          <div className="mb-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4" /> {error}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function ModalActions({ saving, onCancel, onSave, saveLabel }: { saving: boolean; onCancel: () => void; onSave: () => void; saveLabel: string }) {
  return (
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
      <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">
        {saving ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", className = "" }: { label: string; value: string; onChange: (v: string) => void; type?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <input type={type} step={type === "number" ? "any" : undefined} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200" />
    </label>
  );
}
