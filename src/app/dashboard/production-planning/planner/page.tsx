"use client";

import { NativeSelect, DateInput } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Idea as FlaskConical, Alert as AlertCircle, Completed as CheckCircle2, Work as Factory, Retry as RefreshCw } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Product { id: string; name: string }
interface WorkOrder {
  id: string; number: string; status: string; qtyPlanned: number; productId: string;
  plannedStartDate: string | null; plannedEndDate: string | null; dueDate: string | null;
  planningStatus: string | null; deliveryRisk: string | null;
}
interface SkillNeed { skillId: string; skillName: string; required: number; available: number }
interface Stage { stageId: string; stageName: string; plannedStart: string; plannedEnd: string; workCenterName: string | null; skills: SkillNeed[] }
interface Conflict { conflictType: string; severity: string; description: string; suggestedAction: string | null }
interface Result { feasible: boolean; plannedStart: string; plannedEnd: string; deliveryRisk: string; materialReadyDate: string; stages: Stage[]; conflicts: Conflict[] }

const OPEN_STATUSES = new Set(["planned", "released", "in_progress"]);
const statusBadge: Record<string, string> = {
  planned: "bg-blue-50 text-blue-700",
  released: "bg-purple-50 text-purple-700",
  in_progress: "bg-amber-50 text-amber-700",
};
const riskBadge: Record<string, string> = { low: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", high: "bg-orange-100 text-orange-700", impossible: "bg-red-100 text-red-700" };

const fmt = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

export default function PlannerPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [openOrders, setOpenOrders] = useState<WorkOrder[]>([]);
  const [loadingLoad, setLoadingLoad] = useState(true);

  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoadingLoad(false);
    }).catch(() => setLoadingLoad(false));
  }, []);

  const loadContext = useCallback(async () => {
    if (!workspaceId) return;
    setLoadingLoad(true);
    const [pr, wos] = await Promise.all([
      fetch(`/api/products?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/work-orders?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
    ]);
    setProducts(pr.data ?? []);
    const all: WorkOrder[] = wos.data ?? (Array.isArray(wos) ? wos : []);
    setOpenOrders(all.filter((w) => OPEN_STATUSES.has(w.status)));
    setLoadingLoad(false);
  }, [workspaceId]);

  useEffect(() => { loadContext(); }, [loadContext]); // eslint-disable-line react-hooks/set-state-in-effect

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "—";

  const simulate = async () => {
    if (!productId) { setError("Pick a product first."); return; }
    setSimulating(true); setError(""); setResult(null);
    const res = await fetch("/api/work-orders/simulate-new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId, productId, qtyPlanned: Number(qty) || 1,
        dueDate: dueDate ? new Date(dueDate + "T17:00:00").toISOString() : undefined,
      }),
    });
    const j = await res.json().catch(() => null);
    setSimulating(false);
    if (!res.ok) { setError(j?.error || `Simulation failed (HTTP ${res.status})`); return; }
    setResult(j.data ?? null);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <FlaskConical className="h-6 w-6 text-purple-600" />
        <h1 className="text-xl font-semibold text-gray-900">Production Planner — What-if</h1>
      </div>
      <p className="text-sm text-gray-500 mb-6">See what&apos;s running now, and test whether a new order would fit — without creating it.</p>

      {/* ── Current load ── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-6">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2"><Factory className="h-4 w-4 text-blue-600" /> Currently in production ({openOrders.length})</h2>
          <button onClick={loadContext} className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Refresh"><RefreshCw className={`h-4 w-4 ${loadingLoad ? "animate-spin" : ""}`} /></button>
        </div>
        {loadingLoad ? (
          <p className="px-5 py-6 text-sm text-gray-500">Loading…</p>
        ) : openOrders.length === 0 ? (
          <p className="px-5 py-6 text-sm text-gray-500">Nothing in production right now — full capacity available.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="px-5 py-2 font-medium">Order</th><th className="px-3 py-2 font-medium">Product</th><th className="px-3 py-2 font-medium">Qty</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Planned window</th><th className="px-3 py-2 font-medium">Due</th><th className="px-3 py-2 font-medium">Risk</th>
            </tr></thead>
            <tbody>
              {openOrders.map((w) => (
                <tr key={w.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-2.5"><Link href={`/dashboard/production/${w.id}`} className="text-blue-600 hover:underline font-medium">{w.number}</Link></td>
                  <td className="px-3 py-2.5 text-gray-700">{productName(w.productId)}</td>
                  <td className="px-3 py-2.5 text-gray-700">{w.qtyPlanned}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-[4px] text-xs font-medium capitalize ${statusBadge[w.status] ?? "bg-gray-100 text-gray-600"}`}>{w.status.replace("_", " ")}</span></td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{fmt(w.plannedStartDate)} → {fmt(w.plannedEndDate)}</td>
                  <td className="px-3 py-2.5 text-gray-500 text-xs">{w.dueDate ? new Date(w.dueDate).toLocaleDateString() : "—"}</td>
                  <td className="px-3 py-2.5">{w.deliveryRisk ? <span className={`px-2 py-0.5 rounded-[4px] text-xs font-medium ${riskBadge[w.deliveryRisk] ?? "bg-gray-100 text-gray-600"}`}>{w.deliveryRisk}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── What-if form ── */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-800 mb-3">What if I add a new order?</h2>
        <div className="grid grid-cols-12 gap-3 items-end">
          <label className="col-span-5 block"><span className="text-xs text-gray-500">Product</span>
            <NativeSelect value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
              <option value="">Select product…</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </NativeSelect></label>
          <label className="col-span-2 block"><span className="text-xs text-gray-500">Quantity</span>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
          <label className="col-span-3 block"><span className="text-xs text-gray-500">Due date (optional)</span>
            <DateInput value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full" /></label>
          <button onClick={simulate} disabled={simulating || !productId} className="col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
            <FlaskConical className="h-4 w-4" /> {simulating ? "Planning…" : "Check fit"}
          </button>
        </div>
        {error && <div className="mt-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}</div>}
        <p className="mt-3 text-xs text-gray-400">The simulation runs the real planning engine against current work-center bookings, material stock and crew — nothing is created or reserved.</p>
      </div>

      {/* ── Result ── */}
      {result && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="border border-gray-100 rounded-lg p-3">
              <p className="text-xs text-gray-500">Feasible</p>
              <p className={`text-lg font-semibold flex items-center gap-1 ${result.feasible ? "text-green-600" : "text-red-600"}`}>
                {result.feasible ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}{result.feasible ? "Yes" : "Blocked"}
              </p>
            </div>
            <div className="border border-gray-100 rounded-lg p-3"><p className="text-xs text-gray-500">Would start</p><p className="text-lg font-semibold text-gray-900">{fmt(result.plannedStart)}</p></div>
            <div className="border border-gray-100 rounded-lg p-3"><p className="text-xs text-gray-500">Would finish</p><p className="text-lg font-semibold text-gray-900">{fmt(result.plannedEnd)}</p></div>
            <div className="border border-gray-100 rounded-lg p-3"><p className="text-xs text-gray-500">Delivery risk</p>
              <p><span className={`inline-block mt-1 px-2 py-0.5 rounded-[4px] text-sm font-medium ${riskBadge[result.deliveryRisk] ?? "bg-gray-100 text-gray-600"}`}>{result.deliveryRisk}</span></p></div>
          </div>

          {result.conflicts.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Conflicts ({result.conflicts.length})</h3>
              <div className="space-y-2">
                {result.conflicts.map((c, i) => (
                  <div key={i} className={`rounded-md border px-3 py-2 text-sm ${c.severity === "blocker" ? "bg-red-50 border-red-200 text-red-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
                    <p className="font-medium flex items-center gap-1.5"><AlertCircle className="h-4 w-4 flex-shrink-0" /> {c.description}</p>
                    {c.suggestedAction && <p className="text-xs mt-0.5 ml-5.5 opacity-80">→ {c.suggestedAction}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.stages.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">Projected schedule</h3>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 font-medium">Stage</th><th className="py-2 font-medium">Work center</th><th className="py-2 font-medium">Start</th><th className="py-2 font-medium">End</th><th className="py-2 font-medium">Crew</th>
                </tr></thead>
                <tbody>
                  {result.stages.map((s) => (
                    <tr key={s.stageId} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-900">{s.stageName}</td>
                      <td className="py-2 text-gray-600">{s.workCenterName ?? "—"}</td>
                      <td className="py-2 text-gray-600 text-xs">{fmt(s.plannedStart)}</td>
                      <td className="py-2 text-gray-600 text-xs">{fmt(s.plannedEnd)}</td>
                      <td className="py-2 text-xs">
                        {s.skills.length === 0 ? <span className="text-gray-400">any crew</span> : s.skills.map((sk) => (
                          <span key={sk.skillId} className={`inline-block mr-1.5 ${sk.available < sk.required ? "text-red-600 font-medium" : "text-gray-600"}`}>
                            {sk.required}× {sk.skillName} ({sk.available} avail)
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
