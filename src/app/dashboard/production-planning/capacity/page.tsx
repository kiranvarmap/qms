"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import { Dashboard as Gauge } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Load { workCenterId: string; name: string; capacityHoursPerDay: number; scheduledHours: number; jobs: number }

export default function CapacityPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [loads, setLoads] = useState<Load[]>([]);
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
    const r = await fetch(`/api/production-planning/capacity?workspaceId=${workspaceId}`).then((x) => x.json());
    setLoads(r.data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  // Utilization = scheduled hours vs a 5-day week of the center's daily capacity.
  const util = (l: Load) => {
    const weekly = l.capacityHoursPerDay * 5;
    return weekly > 0 ? Math.min(999, Math.round((l.scheduledHours / weekly) * 100)) : 0;
  };
  const barColor = (u: number) => (u >= 100 ? "bg-red-500" : u >= 75 ? "bg-amber-500" : "bg-green-500");

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6"><Gauge className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Capacity Planning</h1></div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <p className="mb-4 text-sm text-gray-500">Scheduled load per work center, against a 5-day week at each center&apos;s daily capacity.</p>

      {loading ? <p className="text-gray-500">Loading…</p> : loads.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-500 shadow-sm">No scheduled load yet. Plan some work orders first.</div>
      ) : (
        <div className="space-y-4">
          {loads.map((l) => {
            const u = util(l);
            return (
              <div key={l.workCenterId} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">{l.name}</span>
                  <span className="text-xs text-gray-500">{l.scheduledHours.toFixed(1)}h scheduled · {l.jobs} stages · {u}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${barColor(u)}`} style={{ width: `${Math.min(100, u)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
