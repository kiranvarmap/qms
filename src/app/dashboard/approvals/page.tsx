"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Inbox } from "lucide-react";

interface Workspace { id: string; name: string }
interface ApprovalRequest {
  id: string;
  subjectType: string;
  subjectId: string;
  status: string;
  currentStep: number;
  createdAt: string;
}

const subjectLabels: Record<string, string> = {
  leave_request: "Leave request",
  purchase_order: "Purchase order",
  expense: "Expense",
  invoice: "Invoice",
};

export default function ApprovalsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data: Workspace[]) => {
        setWorkspaces(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setWorkspaceId(data[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await fetch(`/api/approvals?workspaceId=${workspaceId}&mine=true`);
    const data = await res.json();
    setRequests(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusy(id);
    await fetch(`/api/approvals/${id}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setBusy(null);
    load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Inbox className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">My Approvals</h1>
      </div>

      <select
        value={workspaceId}
        onChange={(e) => setWorkspaceId(e.target.value)}
        className="mb-4 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900"
      >
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="space-y-2">
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : requests.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg px-4 py-12 text-center text-gray-500 text-sm">
            Nothing awaiting your approval.
          </div>
        ) : requests.map((r) => (
          <div key={r.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-gray-900 text-sm font-medium">{subjectLabels[r.subjectType] ?? r.subjectType}</div>
              <div className="text-gray-500 text-xs">Step {r.currentStep} · {new Date(r.createdAt).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => decide(r.id, "approved")}
                disabled={busy === r.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-600 text-xs font-medium rounded-md disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
              <button
                onClick={() => decide(r.id, "rejected")}
                disabled={busy === r.id}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-600 text-xs font-medium rounded-md disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
