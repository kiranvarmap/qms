"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, ChevronRight, ChevronDown } from "lucide-react";

interface Row {
  id: string;
  employeeName: string;
  employeeCode: string;
  workspaceId: string | null;
  workspaceName: string | null;
  boardId: string | null;
  boardName: string | null;
  itemId: string | null;
  itemName: string | null;
  linkLevel: string;
  durationMinutes: number | null;
  status: string;
  checkInAt: string;
}

function fmt(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface TaskAgg { itemId: string; name: string; minutes: number; sessions: number }
interface BoardAgg { boardId: string; name: string; minutes: number; sessions: number; tasks: Map<string, TaskAgg> }
interface WsAgg { workspaceId: string; name: string; minutes: number; sessions: number; boards: Map<string, BoardAgg> }

export default function WorkTimeReportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/labor-report")
      .then((r) => r.json())
      .then((d) => setRows(d.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (k: string) =>
    setExpanded((p) => {
      const n = new Set(p);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  // Roll up rows into Workspace → Board → Task (Plan B.5)
  const { tree, totalMins, totalSessions } = useMemo(() => {
    const ws = new Map<string, WsAgg>();
    let totalMins = 0;
    let totalSessions = 0;
    for (const r of rows) {
      const mins = r.durationMinutes ?? 0;
      totalMins += mins;
      totalSessions += 1;
      const wsId = r.workspaceId ?? "—";
      if (!ws.has(wsId)) ws.set(wsId, { workspaceId: wsId, name: r.workspaceName ?? "Unassigned", minutes: 0, sessions: 0, boards: new Map() });
      const w = ws.get(wsId)!;
      w.minutes += mins; w.sessions += 1;
      if (r.boardId) {
        if (!w.boards.has(r.boardId)) w.boards.set(r.boardId, { boardId: r.boardId, name: r.boardName ?? "Board", minutes: 0, sessions: 0, tasks: new Map() });
        const b = w.boards.get(r.boardId)!;
        b.minutes += mins; b.sessions += 1;
        if (r.itemId) {
          if (!b.tasks.has(r.itemId)) b.tasks.set(r.itemId, { itemId: r.itemId, name: r.itemName ?? "Task", minutes: 0, sessions: 0 });
          const t = b.tasks.get(r.itemId)!;
          t.minutes += mins; t.sessions += 1;
        }
      }
    }
    return { tree: Array.from(ws.values()), totalMins, totalSessions };
  }, [rows]);

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Clock className="w-6 h-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Work Time</h1>
          <p className="text-sm text-gray-500">Labor rolled up by workspace → board → task</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Total Hours</p>
          <p className="text-2xl font-semibold text-gray-900">{fmt(totalMins)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Sessions</p>
          <p className="text-2xl font-semibold text-gray-900">{totalSessions}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Workspaces</p>
          <p className="text-2xl font-semibold text-gray-900">{tree.length}</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : tree.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-10 text-center text-gray-500">
          No work-linked time logs yet. Clock in with a Workspace → Board → Task selected to see roll-ups here.
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
          {tree.map((w) => {
            const wKey = `w:${w.workspaceId}`;
            const wOpen = expanded.has(wKey);
            return (
              <div key={wKey}>
                <button onClick={() => toggle(wKey)} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 text-left">
                  {wOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <span className="font-medium text-gray-900">{w.name}</span>
                  <span className="ml-auto text-sm text-gray-500">{w.sessions} sessions</span>
                  <span className="w-24 text-right font-medium text-gray-900">{fmt(w.minutes)}</span>
                </button>
                {wOpen && Array.from(w.boards.values()).map((b) => {
                  const bKey = `b:${b.boardId}`;
                  const bOpen = expanded.has(bKey);
                  return (
                    <div key={bKey} className="bg-gray-50/50">
                      <button onClick={() => toggle(bKey)} className="w-full flex items-center gap-2 pl-10 pr-4 py-2.5 hover:bg-gray-100 text-left">
                        {bOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                        <span className="text-gray-800">{b.name}</span>
                        <span className="ml-auto text-sm text-gray-500">{b.sessions} sessions</span>
                        <span className="w-24 text-right text-gray-800">{fmt(b.minutes)}</span>
                      </button>
                      {bOpen && Array.from(b.tasks.values()).map((t) => (
                        <div key={`t:${t.itemId}`} className="flex items-center gap-2 pl-16 pr-4 py-2 text-sm">
                          <span className="text-gray-600">{t.name}</span>
                          <span className="ml-auto text-gray-400">{t.sessions} sessions</span>
                          <span className="w-24 text-right text-gray-700">{fmt(t.minutes)}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
