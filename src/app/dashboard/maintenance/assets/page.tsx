"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Add as Plus, Settings as Wrench, CloseSmall as X, Alert as AlertCircle, MoveArrowLeft as ArrowLeft } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Asset { id: string; code: string | null; name: string; type: string | null; location: string | null; status: string; criticality: string; }

const empty = { name: "", code: "", type: "", location: "", criticality: "medium" };

const statusBadge: Record<string, string> = {
  up: "bg-green-100 text-green-700",
  down: "bg-red-100 text-red-700",
  maintenance: "bg-amber-100 text-amber-700",
  retired: "bg-gray-100 text-gray-500",
};

export default function AssetsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
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
    const res = await fetch(`/api/assets?workspaceId=${workspaceId}`);
    const data = await res.json();
    setAssets(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/assets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      workspaceId, name: form.name.trim(), code: form.code.trim() || undefined, type: form.type.trim() || undefined, location: form.location.trim() || undefined, criticality: form.criticality,
    }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm(empty); load();
  };

  const changeStatus = async (assetId: string, status: string) => {
    await fetch(`/api/assets/${assetId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href="/dashboard/maintenance" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Maintenance</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Asset Register</h1>
        </div>
        <button onClick={() => { setForm(empty); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Asset
        </button>
      </div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Location</th>
              <th className="px-4 py-3 font-medium">Criticality</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : assets.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No assets yet.</td></tr>
            ) : assets.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.code || "—"}</td>
                <td className="px-4 py-3"><Link href={`/dashboard/maintenance/assets/${a.id}`} className="text-blue-700 hover:underline">{a.name}</Link></td>
                <td className="px-4 py-3 text-gray-600">{a.location || "—"}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{a.criticality}</td>
                <td className="px-4 py-3">
                  <NativeSelect value={a.status} onChange={(e) => changeStatus(a.id, e.target.value)} className={`rounded-full px-2 py-0.5 text-xs font-medium border-0 ${statusBadge[a.status] || "bg-gray-100 text-gray-700"}`}>
                    <option value="up">up</option>
                    <option value="down">down</option>
                    <option value="maintenance">maintenance</option>
                    <option value="retired">retired</option>
                  </NativeSelect>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Asset</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
                <Field label="Type" value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
              </div>
              <Field label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
              <label className="block">
                <span className="text-xs text-gray-500">Criticality</span>
                <NativeSelect value={form.criticality} onChange={(e) => setForm({ ...form, criticality: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </NativeSelect>
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
    </label>
  );
}
