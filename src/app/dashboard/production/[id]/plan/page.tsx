"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, Lock, FlaskConical } from "lucide-react";

interface Material { description: string; required: number; available: number; reserved: number; incoming: number; incomingDate: string | null; shortage: number; critical: boolean; unit: string; status: string }
interface Stage { stageId: string; stageName: string; plannedStart: string; plannedEnd: string; workCenterName: string | null; requiredHeadcount: number; availableHeadcount: number }
interface Conflict { conflictType: string; severity: string; description: string; suggestedAction: string | null }
interface Result {
  feasible: boolean; materialReadyDate: string; plannedStart: string; plannedEnd: string;
  deliveryRisk: string; dueDate: string | null; materials: Material[]; stages: Stage[]; conflicts: Conflict[];
}

const riskBadge: Record<string, string> = { low: "bg-green-100 text-green-700", medium: "bg-amber-100 text-amber-700", high: "bg-orange-100 text-orange-700", impossible: "bg-red-100 text-red-700" };
const matStatus: Record<string, string> = { available: "bg-green-100 text-green-700", incoming: "bg-amber-100 text-amber-700", short: "bg-red-100 text-red-700" };

export default function FeasibilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reserved, setReserved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/work-orders/${id}/feasibility?refresh=1`).then((x) => x.json());
    setResult(r.computed ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const replan = async () => { setBusy(true); await fetch(`/api/work-orders/${id}/plan`, { method: "POST" }); await load(); setBusy(false); };
  const reserve = async () => { setBusy(true); await fetch(`/api/work-orders/${id}/reserve-materials`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }); setReserved(true); setBusy(false); };

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const fmtDay = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—");

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href={`/dashboard/production/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Work order</Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Production Feasibility</h1>
        <div className="flex gap-2">
          <Link href={`/dashboard/production/${id}/simulate`} className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md"><FlaskConical className="h-4 w-4" /> What-if</Link>
          <button onClick={reserve} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-800 text-sm font-medium rounded-md"><Lock className="h-4 w-4" /> {reserved ? "Reserved" : "Reserve materials"}</button>
          <button onClick={replan} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Re-plan</button>
        </div>
      </div>

      {loading ? <p className="text-gray-500">Computing feasibility…</p> : !result ? <p className="text-gray-500">No plan available.</p> : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <p className="text-xs text-gray-500">Feasible</p>
              <p className={`text-lg font-semibold flex items-center gap-1 ${result.feasible ? "text-green-600" : "text-red-600"}`}>
                {result.feasible ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}{result.feasible ? "Yes" : "Blocked"}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"><p className="text-xs text-gray-500">Material ready</p><p className="text-lg font-semibold text-gray-900">{fmtDay(result.materialReadyDate)}</p></div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"><p className="text-xs text-gray-500">Est. completion</p><p className="text-lg font-semibold text-gray-900">{fmtDay(result.plannedEnd)}</p></div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"><p className="text-xs text-gray-500">Delivery risk</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium mt-1 ${riskBadge[result.deliveryRisk] || "bg-gray-100 text-gray-700"}`}>{result.deliveryRisk}</span></div>
          </div>

          {result.conflicts.length > 0 && (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Bottlenecks ({result.conflicts.length})</h2>
              <div className="space-y-2">
                {result.conflicts.map((c, i) => (
                  <div key={i} className={`bg-white border rounded-lg p-3 shadow-sm flex items-start gap-2 ${c.severity === "blocker" ? "border-red-200" : "border-amber-200"}`}>
                    <AlertCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${c.severity === "blocker" ? "text-red-500" : "text-amber-500"}`} />
                    <div><p className="text-sm text-gray-900">{c.description}</p>{c.suggestedAction && <p className="text-xs text-gray-500 mt-0.5">→ {c.suggestedAction}</p>}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Material Availability</h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 font-medium">Component</th><th className="px-4 py-2 font-medium text-right">Required</th><th className="px-4 py-2 font-medium text-right">Available</th>
                  <th className="px-4 py-2 font-medium text-right">Incoming</th><th className="px-4 py-2 font-medium text-right">Shortage</th><th className="px-4 py-2 font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {result.materials.length === 0 ? <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No materials defined.</td></tr>
                  : result.materials.map((m, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-900">{m.description}{m.critical && <span className="ml-1 text-red-500" title="Critical">⚠</span>}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{m.required.toFixed(2)} {m.unit}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{m.available.toFixed(2)}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{m.incoming > 0 ? `${m.incoming.toFixed(2)}${m.incomingDate ? ` (${fmtDay(m.incomingDate)})` : ""}` : "—"}</td>
                      <td className="px-4 py-2 text-right font-medium" style={{ color: m.shortage > 0 ? "#dc2626" : "#16a34a" }}>{m.shortage > 0 ? m.shortage.toFixed(2) : "—"}</td>
                      <td className="px-4 py-2"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${matStatus[m.status] || "bg-gray-100 text-gray-700"}`}>{m.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-2">Timeline Forecast</h2>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2 font-medium">Stage</th><th className="px-4 py-2 font-medium">Work Center</th><th className="px-4 py-2 font-medium">Start</th><th className="px-4 py-2 font-medium">End</th><th className="px-4 py-2 font-medium text-right">Crew</th>
                </tr></thead>
                <tbody>
                  {result.stages.map((s, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="px-4 py-2 text-gray-900 font-medium">{s.stageName}</td>
                      <td className="px-4 py-2 text-gray-600">{s.workCenterName || "—"}</td>
                      <td className="px-4 py-2 text-gray-600">{fmt(s.plannedStart)}</td>
                      <td className="px-4 py-2 text-gray-600">{fmt(s.plannedEnd)}</td>
                      <td className="px-4 py-2 text-right" style={{ color: s.availableHeadcount < s.requiredHeadcount ? "#dc2626" : "#6b7280" }}>{s.availableHeadcount}/{s.requiredHeadcount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
