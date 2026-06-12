"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Warning as AlertTriangle, Alert as AlertCircle } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Conflict { id: string; workOrderId: string; number: string; conflictType: string; severity: string; description: string; suggestedAction: string | null }

const typeLabel: Record<string, string> = {
  material_shortage: "Material shortage", machine_overload: "Machine overload", manpower_short: "Manpower short",
  skill_unavailable: "Skill unavailable", maintenance_block: "Maintenance block", po_delay: "PO delay",
  delivery_impossible: "Delivery impossible", no_template: "No template", no_work_center: "No work center",
};

export default function BottlenecksPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const r = await fetch(`/api/production-planning/conflicts?workspaceId=${workspaceId}`).then((x) => x.json());
    setConflicts(r.data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const blockers = conflicts.filter((c) => c.severity === "blocker");
  const warnings = conflicts.filter((c) => c.severity === "warning");

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6"><AlertTriangle className="h-6 w-6 text-amber-600" /><h1 className="text-xl font-semibold text-gray-900">Bottleneck Dashboard</h1></div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"><p className="text-xs text-gray-500">Blockers</p><p className="text-2xl font-semibold text-red-600">{blockers.length}</p></div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"><p className="text-xs text-gray-500">Warnings</p><p className="text-2xl font-semibold text-amber-600">{warnings.length}</p></div>
      </div>

      {loading ? <p className="text-gray-500">Loading…</p> : conflicts.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-500 shadow-sm">No open conflicts. Every planned job is feasible. 🎉</div>
      ) : (
        <div className="space-y-2">
          {conflicts.map((c) => (
            <div key={c.id} className={`bg-white border rounded-lg p-4 shadow-sm flex items-start gap-3 ${c.severity === "blocker" ? "border-red-200" : "border-amber-200"}`}>
              <AlertCircle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${c.severity === "blocker" ? "text-red-500" : "text-amber-500"}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${c.severity === "blocker" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{typeLabel[c.conflictType] || c.conflictType}</span>
                  <Link href={`/dashboard/production/${c.workOrderId}/plan`} className="text-xs text-blue-600 hover:underline font-mono">{c.number}</Link>
                </div>
                <p className="text-sm text-gray-900 mt-1">{c.description}</p>
                {c.suggestedAction && <p className="text-xs text-gray-500 mt-1">→ {c.suggestedAction}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
