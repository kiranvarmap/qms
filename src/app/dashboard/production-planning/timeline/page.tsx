"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { CalendarRange } from "lucide-react";

interface Workspace { id: string; name: string }
interface Block { id: string; workOrderId: string; number: string; stageName: string; plannedStart: string | null; plannedEnd: string | null; status: string; priority: string }

const priorityColor: Record<string, string> = {
  low: "bg-gray-400", normal: "bg-blue-500", high: "bg-amber-500", urgent: "bg-red-500",
};

export default function TimelinePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
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
    const r = await fetch(`/api/production-planning/timeline?workspaceId=${workspaceId}`).then((x) => x.json());
    setBlocks((r.data ?? []).filter((b: Block) => b.plannedStart && b.plannedEnd));
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  // Compute the overall window for the Gantt scale. Fallbacks are unused — the
  // empty state renders instead when there are no blocks.
  const times = blocks.flatMap((b) => [new Date(b.plannedStart!).getTime(), new Date(b.plannedEnd!).getTime()]);
  const min = times.length ? Math.min(...times) : 0;
  const max = times.length ? Math.max(...times) : 1;
  const span = Math.max(1, max - min);

  // Group blocks by work order for swimlanes.
  const byJob = new Map<string, { number: string; blocks: Block[] }>();
  for (const b of blocks) {
    const cur = byJob.get(b.workOrderId) ?? { number: b.number, blocks: [] };
    cur.blocks.push(b);
    byJob.set(b.workOrderId, cur);
  }

  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6"><CalendarRange className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Production Timeline</h1></div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      {loading ? <p className="text-gray-500">Loading…</p> : byJob.size === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 text-center text-gray-500 shadow-sm">No scheduled stages. Plan some work orders to populate the timeline.</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm overflow-x-auto">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-3 px-1"><span>{fmt(min)}</span><span>{fmt((min + max) / 2)}</span><span>{fmt(max)}</span></div>
          <div className="space-y-2">
            {[...byJob.entries()].map(([jobId, job]) => (
              <div key={jobId} className="flex items-center gap-3">
                <Link href={`/dashboard/production/${jobId}/plan`} className="w-24 flex-shrink-0 text-xs text-blue-600 hover:underline font-mono truncate">{job.number}</Link>
                <div className="relative flex-1 h-7 bg-gray-50 rounded">
                  {job.blocks.map((b) => {
                    const s = new Date(b.plannedStart!).getTime();
                    const e = new Date(b.plannedEnd!).getTime();
                    const left = ((s - min) / span) * 100;
                    const width = Math.max(1.5, ((e - s) / span) * 100);
                    return (
                      <div key={b.id} title={`${b.stageName}: ${new Date(s).toLocaleString()} → ${new Date(e).toLocaleString()}`}
                        className={`absolute top-0.5 h-6 rounded ${priorityColor[b.priority] || "bg-blue-500"} opacity-90 hover:opacity-100 flex items-center px-1 overflow-hidden`}
                        style={{ left: `${left}%`, width: `${width}%` }}>
                        <span className="text-[10px] text-white truncate">{b.stageName}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500 inline-block" /> Urgent</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> High</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Normal</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-400 inline-block" /> Low</span>
          </div>
        </div>
      )}
    </div>
  );
}
