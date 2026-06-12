"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Add as Plus, CheckList as ClipboardCheck, CloseSmall as X, MoveArrowLeft as ArrowLeft } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Warehouse { id: string; name: string }
interface CC { id: string; status: string; warehouseId: string | null; note: string | null; createdAt: string; }

const statusBadge: Record<string, string> = { open: "bg-blue-100 text-blue-700", counted: "bg-amber-100 text-amber-700", posted: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-500" };

export default function CycleCountsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [counts, setCounts] = useState<CC[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [cc, wh] = await Promise.all([
      fetch(`/api/inventory/cycle-counts?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/warehouses?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setCounts(cc.data ?? []);
    setWarehouses(wh.data ?? wh ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    setSaving(true);
    await fetch("/api/inventory/cycle-counts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, warehouseId: warehouseId || undefined, note: note.trim() || undefined }) });
    setSaving(false); setShowCreate(false); setNote(""); setWarehouseId(""); load();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><ClipboardCheck className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Cycle Counts</h1></div>
        <button onClick={() => setShowCreate(true)} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Count</button>
      </div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium">Created</th><th className="px-4 py-3 font-medium">Note</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium text-right">Open</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : counts.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No cycle counts yet.</td></tr>
            : counts.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-600">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-900">{c.note || "—"}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[c.status]}`}>{c.status}</span></td>
                <td className="px-4 py-3 text-right"><Link href={`/dashboard/inventory/cycle-counts/${c.id}`} className="text-blue-600 hover:underline text-xs">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Cycle Count</h2><button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <p className="text-sm text-gray-500 mb-3">Snapshots current system on-hand for counting.</p>
            <label className="block mb-3"><span className="text-xs text-gray-500">Warehouse (optional — all if blank)</span>
              <NativeSelect value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">All</option>{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</NativeSelect>
            </label>
            <label className="block mb-4"><span className="text-xs text-gray-500">Note</span><input value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
            <div className="flex justify-end gap-2"><button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Creating…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
