"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Warning as ShieldAlert, Search, Completed as CheckCircle2, Add as Plus, Locked as Lock } from "@vibe/icons";

interface Incident { id: string; number: string; type: string; severity: string; status: string; location: string | null; description: string | null; rootCause: string | null; }
interface Action { id: string; description: string; status: string; dueDate: string | null; }

const sevBadge: Record<string, string> = { low: "bg-gray-100 text-gray-700", medium: "bg-amber-100 text-amber-700", high: "bg-orange-100 text-orange-700", critical: "bg-red-100 text-red-700" };
const statusBadge: Record<string, string> = { reported: "bg-blue-100 text-blue-700", investigating: "bg-amber-100 text-amber-700", actions_open: "bg-orange-100 text-orange-700", closed: "bg-green-100 text-green-700" };

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const [inc, setInc] = useState<Incident | null>(null);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [rootCause, setRootCause] = useState("");
  const [newAction, setNewAction] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/incidents/${id}`);
    const data = await res.json();
    if (res.ok && data.incident) { setInc(data.incident); setActions(data.actions ?? []); setRootCause(data.incident.rootCause ?? ""); }
    else setInc(null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const investigate = async () => {
    setBusy(true);
    await fetch(`/api/incidents/${id}/investigate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rootCause: rootCause.trim() || undefined }) });
    setBusy(false); load();
  };
  const addAction = async () => {
    if (!newAction.trim()) return;
    await fetch(`/api/incidents/${id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description: newAction.trim() }) });
    setNewAction(""); load();
  };
  const toggle = async (actionId: string, status: string) => {
    await fetch(`/api/incidents/${id}/actions`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId, status: status === "done" ? "open" : "done" }) });
    load();
  };
  const close = async () => { setBusy(true); await fetch(`/api/incidents/${id}/close`, { method: "POST" }); setBusy(false); load(); };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!inc) return <div className="p-8 text-gray-500">Incident not found. <Link href="/dashboard/safety" className="text-blue-600 hover:underline">Back</Link></div>;

  const openActions = actions.filter((a) => a.status === "open").length;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/safety" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Safety</Link>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-900">
              <ShieldAlert className="h-5 w-5 text-blue-600" />
              <h1 className="text-xl font-semibold font-mono">{inc.number}</h1>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${sevBadge[inc.severity]}`}>{inc.severity}</span>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[inc.status]}`}>{inc.status.replace("_", " ")}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1 capitalize">{inc.type.replace("_", " ")}{inc.location ? ` · ${inc.location}` : ""}</p>
            {inc.description && <p className="text-sm text-gray-700 mt-3">{inc.description}</p>}
          </div>
          {inc.status !== "closed" && (
            <button onClick={close} disabled={busy || openActions > 0} title={openActions > 0 ? "Close open actions first" : ""} className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 text-white text-sm rounded-md"><Lock className="h-4 w-4" /> Close</button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 text-gray-900 font-medium mb-3"><Search className="h-4 w-4 text-blue-600" /> Investigation</div>
        <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={3} placeholder="Root cause / findings…" className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
        <div className="mt-3"><button onClick={investigate} disabled={busy} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-md">Save investigation</button></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 text-gray-900 font-medium mb-3"><CheckCircle2 className="h-4 w-4 text-blue-600" /> Corrective Actions</div>
        {actions.length === 0 ? <p className="text-sm text-gray-500 mb-4">No actions yet.</p> : (
          <div className="divide-y divide-gray-100 mb-4">
            {actions.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2 text-sm">
                <label className="flex items-center gap-2 text-gray-900">
                  <input type="checkbox" checked={a.status === "done"} onChange={() => toggle(a.id, a.status)} />
                  <span className={a.status === "done" ? "line-through text-gray-400" : ""}>{a.description}</span>
                </label>
                <span className={`text-xs rounded-full px-2 py-0.5 ${a.status === "done" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>{a.status}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="New corrective action…" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
          <button onClick={addAction} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
        </div>
      </div>
    </div>
  );
}
