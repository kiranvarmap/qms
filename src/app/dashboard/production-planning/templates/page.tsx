"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, GitBranch, X, AlertCircle } from "lucide-react";

interface Workspace { id: string; name: string }
interface Product { id: string; name: string; sku: string | null }
interface Template { id: string; productId: string; version: string; name: string | null; status: string; productName: string }

const statusBadge: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700", active: "bg-green-100 text-green-700", archived: "bg-amber-100 text-amber-700",
};

export default function TemplatesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ productId: "", version: "v1", name: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [t, p] = await Promise.all([
      fetch(`/api/process-templates?workspaceId=${workspaceId}`).then((x) => x.json()),
      fetch(`/api/products?workspaceId=${workspaceId}`).then((x) => x.json()),
    ]);
    setTemplates(t.data ?? []);
    setProducts(p.data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.productId) { setError("Pick a product"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/process-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, productId: form.productId, version: form.version || "v1", name: form.name || undefined }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm({ productId: "", version: "v1", name: "" }); load();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><GitBranch className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Process Templates</h1></div>
        <button onClick={() => { setForm({ productId: "", version: "v1", name: "" }); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Template
        </button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <p className="mb-4 text-sm text-gray-500">Define how each product is made — the ordered stages, their work centers, durations, materials, and manpower. The active version is what the planning engine schedules.</p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">Version</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : templates.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No templates yet.</td></tr>
            : templates.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3"><Link href={`/dashboard/production-planning/templates/${t.id}`} className="text-blue-600 hover:underline font-medium">{t.productName}</Link></td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{t.version}</td>
                <td className="px-4 py-3 text-gray-600">{t.name || "—"}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[t.status] || "bg-gray-100 text-gray-700"}`}>{t.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Process Template</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Product *</span>
                <select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="">Select…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ""}</option>)}
                </select></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Version</span>
                  <input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
                <label className="block"><span className="text-xs text-gray-500">Name</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
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
