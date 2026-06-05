"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Package, X, AlertCircle, GitPullRequestArrow } from "lucide-react";

interface Workspace { id: string; name: string }
interface Product {
  id: string; sku: string | null; name: string; category: string | null;
  unit: string; type: string; priceMinor: number; lifecycleStatus?: string;
}

const empty = { name: "", sku: "", category: "", unit: "unit", type: "good", cost: "", price: "", lifecycleStatus: "active" };

const lifecycleBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  active: "bg-green-100 text-green-700",
  obsolete: "bg-red-100 text-red-700",
};

export default function ProductsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
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
    const res = await fetch(`/api/products?workspaceId=${workspaceId}`);
    const data = await res.json();
    setProducts(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name: form.name.trim(),
        sku: form.sku.trim() || undefined,
        category: form.category.trim() || undefined,
        unit: form.unit.trim() || "unit",
        type: form.type,
        cost: form.cost ? Number(form.cost) : undefined,
        price: form.price ? Number(form.price) : undefined,
        lifecycleStatus: form.lifecycleStatus,
      }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm(empty); load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/products/ecr" className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-md">
            <GitPullRequestArrow className="h-4 w-4" /> Change Requests
          </Link>
          <button onClick={() => { setForm(empty); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
            <Plus className="h-4 w-4" /> New Product
          </button>
        </div>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Lifecycle</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No products yet.</td></tr>
            ) : products.map((p) => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{p.sku || "—"}</td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/products/${p.id}`} className="text-blue-600 hover:underline font-medium">{p.name}</Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.category || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${lifecycleBadge[p.lifecycleStatus || "active"] || "bg-gray-100 text-gray-700"}`}>
                    {p.lifecycleStatus || "active"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-900">{(p.priceMinor / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Product</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
                <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-500">Type</span>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                    <option value="good">Good</option>
                    <option value="service">Service</option>
                  </select>
                </label>
                <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
                <label className="block">
                  <span className="text-xs text-gray-500">Lifecycle</span>
                  <select value={form.lifecycleStatus} onChange={(e) => setForm({ ...form, lifecycleStatus: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="obsolete">Obsolete</option>
                  </select>
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cost" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} type="number" />
                <Field label="Price" value={form.price} onChange={(v) => setForm({ ...form, price: v })} type="number" />
              </div>
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

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:border-blue-500" />
    </label>
  );
}
