"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Warehouse as WarehouseIcon, Trash2, ArrowLeft, X, AlertCircle } from "lucide-react";

interface Workspace { id: string; name: string }
interface Warehouse { id: string; name: string; code: string | null; location: string | null; isDefault: boolean; isActive: boolean }

const emptyForm = { name: "", code: "", location: "", isDefault: false };

export default function WarehousesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [rows, setRows] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
    const res = await fetch(`/api/warehouses?workspaceId=${workspaceId}`);
    const data = await res.json();
    setRows(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name: form.name.trim(), code: form.code.trim() || undefined, location: form.location.trim() || undefined, isDefault: form.isDefault }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm(emptyForm); load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
    setDeleteConfirm(null); load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Inventory
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <WarehouseIcon className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Warehouses</h1>
        </div>
        <button onClick={() => { setForm(emptyForm); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Warehouse
        </button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No warehouses yet.</td></tr>
            ) : rows.map((w) => (
              <tr key={w.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{w.name} {w.isDefault && <span className="ml-1 text-xs text-blue-600">default</span>}</td>
                <td className="px-4 py-3 text-gray-600">{w.code || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{w.location || "—"}</td>
                <td className="px-4 py-3 text-right">
                  {deleteConfirm === w.id ? (
                    <span className="inline-flex items-center gap-1">
                      <button onClick={() => remove(w.id)} className="p-1.5 text-red-600 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-500 hover:text-gray-700"><X className="h-4 w-4" /></button>
                    </span>
                  ) : (
                    <button onClick={() => setDeleteConfirm(w.id)} className="p-1.5 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Warehouse</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-500/10 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <label className="block"><span className="text-xs text-gray-500">Code</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <label className="block"><span className="text-xs text-gray-500">Location</span><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default warehouse</label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
