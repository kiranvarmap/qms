"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Plus, X } from "lucide-react";

interface Workspace { id: string; name: string }
interface Warehouse { id: string; name: string }
interface Loc { id: string; code: string; name: string | null; kind: string; warehouseId: string; isBlocked: boolean; }

export default function LocationsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locs, setLocs] = useState<Loc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ warehouseId: "", code: "", name: "", kind: "bin" });
  const [saving, setSaving] = useState(false);

  const whName = (id: string) => warehouses.find((w) => w.id === id)?.name ?? "—";

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [lc, wh] = await Promise.all([
      fetch(`/api/inventory/locations?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/warehouses?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setLocs(lc.data ?? []);
    setWarehouses(wh.data ?? wh ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.warehouseId || !form.code.trim()) return;
    setSaving(true);
    await fetch("/api/inventory/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, warehouseId: form.warehouseId, code: form.code.trim(), name: form.name.trim() || undefined, kind: form.kind }) });
    setSaving(false); setShowCreate(false); setForm({ warehouseId: "", code: "", name: "", kind: "bin" }); load();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><MapPin className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Locations / Bins</h1></div>
        <button onClick={() => setShowCreate(true)} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Location</button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium">Code</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Kind</th><th className="px-4 py-3 font-medium">Warehouse</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : locs.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No locations yet.</td></tr>
            : locs.map((l) => (
              <tr key={l.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900 font-mono text-xs">{l.code}</td>
                <td className="px-4 py-3 text-gray-700">{l.name || "—"}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{l.kind}</td>
                <td className="px-4 py-3 text-gray-600">{whName(l.warehouseId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Location</h2><button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Warehouse</span>
                <select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">Select…</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Code</span><input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
                <label className="block"><span className="text-xs text-gray-500">Kind</span>
                  <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                    <option value="zone">Zone</option><option value="aisle">Aisle</option><option value="rack">Rack</option><option value="shelf">Shelf</option><option value="bin">Bin</option>
                  </select>
                </label>
              </div>
              <label className="block"><span className="text-xs text-gray-500">Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
