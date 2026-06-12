"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Work as Factory, Play, Completed as CheckCircle2, Dashboard as Gauge } from "@vibe/icons";

interface WorkOrder { id: string; number: string; productId: string; status: string; qtyPlanned: number; qtyProduced: number; qtyScrapped: number; dueDate: string | null; }
interface Material { id: string; description: string | null; qtyRequired: number; qtyIssued: number; unit: string; }

const statusBadge: Record<string, string> = {
  planned: "bg-gray-100 text-gray-700",
  released: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [wo, setWo] = useState<WorkOrder | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qtyProduced, setQtyProduced] = useState("");
  const [qtyScrapped, setQtyScrapped] = useState("0");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/work-orders/${id}`);
    const data = await res.json();
    if (res.ok && data.workOrder) {
      setWo(data.workOrder);
      setMaterials(data.materials ?? []);
      setQtyProduced(String(data.workOrder.qtyPlanned ?? ""));
    } else setWo(null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const release = async () => {
    setBusy(true); setError("");
    const res = await fetch(`/api/work-orders/${id}/release`, { method: "POST" });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    load();
  };

  const complete = async () => {
    setBusy(true); setError("");
    const res = await fetch(`/api/work-orders/${id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qtyProduced: Number(qtyProduced) || 0, qtyScrapped: Number(qtyScrapped) || 0 }) });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!wo) return <div className="p-8 text-gray-500">Work order not found. <Link href="/dashboard/production" className="text-blue-600 hover:underline">Back</Link></div>;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/production" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Production</Link>

      {error && <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-900">
              <Factory className="h-5 w-5 text-blue-600" />
              <h1 className="text-xl font-semibold font-mono">{wo.number}</h1>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[wo.status] || "bg-gray-100 text-gray-700"}`}>{wo.status.replace("_", " ")}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Planned {wo.qtyPlanned} · Produced {wo.qtyProduced} · Scrapped {wo.qtyScrapped}{wo.dueDate ? ` · Due ${new Date(wo.dueDate).toLocaleDateString()}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/dashboard/production/${wo.id}/plan`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm rounded-md"><Gauge className="h-4 w-4" /> Feasibility</Link>
            {wo.status === "planned" && (
              <button onClick={release} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-md"><Play className="h-4 w-4" /> Release</button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 font-medium text-gray-900">Materials</div>
        {materials.length === 0 ? <p className="px-6 py-4 text-sm text-gray-500">No materials (no BOM exploded).</p> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-6 py-2 font-medium">Component</th>
                <th className="px-6 py-2 font-medium text-right">Required</th>
                <th className="px-6 py-2 font-medium text-right">Issued</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-6 py-2 text-gray-900">{m.description || "—"}</td>
                  <td className="px-6 py-2 text-right text-gray-600">{m.qtyRequired.toFixed(2)} {m.unit}</td>
                  <td className="px-6 py-2 text-right text-gray-600">{m.qtyIssued.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(wo.status === "released" || wo.status === "in_progress") && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="font-medium text-gray-900 mb-3">Complete work order</div>
          <p className="text-sm text-gray-500 mb-3">Completing consumes the materials from stock and receives finished goods into inventory.</p>
          <div className="flex items-end gap-3">
            <label className="block">
              <span className="text-xs text-gray-500">Qty produced</span>
              <input type="number" value={qtyProduced} onChange={(e) => setQtyProduced(e.target.value)} className="mt-1 w-32 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
            </label>
            <label className="block">
              <span className="text-xs text-gray-500">Qty scrapped</span>
              <input type="number" value={qtyScrapped} onChange={(e) => setQtyScrapped(e.target.value)} className="mt-1 w-32 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
            </label>
            <button onClick={complete} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-md"><CheckCircle2 className="h-4 w-4" /> Complete</button>
          </div>
        </div>
      )}
    </div>
  );
}
