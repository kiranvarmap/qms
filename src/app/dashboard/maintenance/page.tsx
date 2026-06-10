"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Wrench, X, AlertCircle, Boxes, Play, CheckCircle2, CalendarClock } from "lucide-react";

interface Workspace { id: string; name: string }
interface Asset { id: string; name: string; code: string | null }
interface Product { id: string; name: string }
interface MO { id: string; number: string; assetId: string; type: string; priority: string; status: string; }

const empty = { assetId: "", type: "corrective", priority: "normal", fault: "", scheduledDate: "" };

const statusBadge: Record<string, string> = {
  open: "bg-gray-100 text-gray-700",
  in_progress: "bg-amber-100 text-amber-700",
  on_hold: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function MaintenancePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [orders, setOrders] = useState<MO[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [completing, setCompleting] = useState<MO | null>(null);
  const [downtime, setDowntime] = useState("0");
  const [parts, setParts] = useState<{ partProductId: string; qtyUsed: string }[]>([]);

  const assetName = (id: string) => assets.find((a) => a.id === id)?.name ?? "—";

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [mo, as, pr] = await Promise.all([
      fetch(`/api/maintenance-orders?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/assets?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/products?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setOrders(mo.data ?? []);
    setAssets(as.data ?? []);
    setProducts(pr.data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.assetId) { setError("Pick an asset"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/maintenance-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      workspaceId, assetId: form.assetId, type: form.type, priority: form.priority, fault: form.fault.trim() || undefined,
      scheduledDate: form.scheduledDate ? new Date(form.scheduledDate).toISOString() : undefined,
    }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm(empty); load();
  };

  const start = async (id: string) => { await fetch(`/api/maintenance-orders/${id}/start`, { method: "POST" }); load(); };

  const openComplete = (mo: MO) => { setCompleting(mo); setDowntime("0"); setParts([]); };
  const complete = async () => {
    if (!completing) return;
    setSaving(true);
    const payloadParts = parts.filter((p) => p.partProductId).map((p) => ({ partProductId: p.partProductId, qtyUsed: Number(p.qtyUsed) || 1 }));
    await fetch(`/api/maintenance-orders/${completing.id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ downtimeHours: Number(downtime) || 0, parts: payloadParts }) });
    setSaving(false); setCompleting(null); load();
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Maintenance</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/maintenance/pm-schedules" className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-md"><CalendarClock className="h-4 w-4" /> PM Schedules</Link>
          <Link href="/dashboard/maintenance/assets" className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-md"><Boxes className="h-4 w-4" /> Assets</Link>
          <button onClick={() => { setForm(empty); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Order</button>
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
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Asset</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No maintenance orders yet.</td></tr>
            ) : orders.map((o) => (
              <tr key={o.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{o.number}</td>
                <td className="px-4 py-3 text-gray-900">{assetName(o.assetId)}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{o.type}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{o.priority}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[o.status] || "bg-gray-100 text-gray-700"}`}>{o.status.replace("_", " ")}</span></td>
                <td className="px-4 py-3 text-right">
                  {(o.status === "open" || o.status === "on_hold") && <button onClick={() => start(o.id)} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><Play className="h-3.5 w-3.5" /> Start</button>}
                  {o.status === "in_progress" && <button onClick={() => openComplete(o)} className="inline-flex items-center gap-1 text-xs text-green-700 hover:underline"><CheckCircle2 className="h-3.5 w-3.5" /> Complete</button>}
                  {(o.status === "completed" || o.status === "cancelled") && <span className="text-gray-300">—</span>}
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
              <h2 className="text-lg font-semibold text-gray-900">New Maintenance Order</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-gray-500">Asset *</span>
                <select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="">Select…</option>
                  {assets.map((a) => <option key={a.id} value={a.id}>{a.name}{a.code ? ` (${a.code})` : ""}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-gray-500">Type</span>
                  <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                    <option value="corrective">Corrective</option>
                    <option value="preventive">Preventive</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-gray-500">Priority</span>
                  <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="text-xs text-gray-500">Fault / description</span>
                <textarea value={form.fault} onChange={(e) => setForm({ ...form, fault: e.target.value })} rows={2} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
              </label>
              <label className="block">
                <span className="text-xs text-gray-500">Scheduled date</span>
                <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {completing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setCompleting(null)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Complete {completing.number}</h2>
              <button onClick={() => setCompleting(null)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-3">Spares listed here are consumed from inventory.</p>
            <label className="block mb-3">
              <span className="text-xs text-gray-500">Downtime (hours)</span>
              <input type="number" value={downtime} onChange={(e) => setDowntime(e.target.value)} className="mt-1 w-32 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
            </label>
            <div className="space-y-2 mb-3">
              {parts.map((p, i) => (
                <div key={i} className="flex gap-2">
                  <select value={p.partProductId} onChange={(e) => setParts(parts.map((x, j) => j === i ? { ...x, partProductId: e.target.value } : x))} className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                    <option value="">Select part…</option>
                    {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
                  </select>
                  <input type="number" value={p.qtyUsed} onChange={(e) => setParts(parts.map((x, j) => j === i ? { ...x, qtyUsed: e.target.value } : x))} className="w-20 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                </div>
              ))}
              <button onClick={() => setParts([...parts, { partProductId: "", qtyUsed: "1" }])} className="text-sm text-gray-600 hover:text-gray-900">+ spare part</button>
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <button onClick={() => setCompleting(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={complete} disabled={saving} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Complete"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
