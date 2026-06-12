"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import { Item as Boxes } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Req { componentProductId: string | null; description: string; unit: string; required: number; available: number; shortage: number }

export default function MaterialRequirementsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [reqs, setReqs] = useState<Req[]>([]);
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
    const r = await fetch(`/api/production-planning/materials?workspaceId=${workspaceId}`).then((x) => x.json());
    setReqs(r.data ?? []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6"><Boxes className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Material Requirements</h1></div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <p className="mb-4 text-sm text-gray-500">Outstanding component demand across all open work orders, against current available stock.</p>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium">Component</th><th className="px-4 py-3 font-medium text-right">Required</th>
            <th className="px-4 py-3 font-medium text-right">Available</th><th className="px-4 py-3 font-medium text-right">Shortage</th><th className="px-4 py-3 font-medium">Status</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : reqs.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No outstanding material demand.</td></tr>
            : reqs.map((r, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{r.description}</td>
                <td className="px-4 py-3 text-right text-gray-600">{r.required.toFixed(2)} {r.unit}</td>
                <td className="px-4 py-3 text-right text-gray-600">{r.available.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-medium" style={{ color: r.shortage > 0 ? "#dc2626" : "#16a34a" }}>{r.shortage > 0 ? r.shortage.toFixed(2) : "—"}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.shortage > 0 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>{r.shortage > 0 ? "Short" : "OK"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
