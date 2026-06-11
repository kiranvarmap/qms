"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Inbox, CheckCircle2, XCircle, ClipboardList, Send, Bell } from "lucide-react";

interface Workspace { id: string; name: string }
interface ApprovalRow { id: string; subjectType: string; subjectId: string; createdAt: string; dueAt: string | null; overdue: boolean }
interface RequestRow { id: string; subjectType: string; subjectId: string; currentStep: number; createdAt: string }
interface InspectionRow { id: string; title: string; status: string; createdAt: string }
interface NotificationRow { id: string; type: string; title: string; body: string | null; createdAt: string }

interface MyWork {
  approvalsToDecide: ApprovalRow[];
  myRequests: RequestRow[];
  openInspections: InspectionRow[];
  unread: NotificationRow[];
}

const subjectLabel = (t: string) => t.replace(/_/g, " ");
const fmt = (d: string) => new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function MyWorkPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [data, setData] = useState<MyWork | null>(null);
  const [loading, setLoading] = useState(true);
  const [deciding, setDeciding] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await fetch(`/api/my-work?workspaceId=${workspaceId}`);
    const d = await res.json();
    setData(res.ok ? d : null);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const decide = async (requestId: string, decision: "approved" | "rejected") => {
    setDeciding(requestId);
    await fetch(`/api/approvals/${requestId}/decide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setDeciding(null);
    load();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Inbox className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">My Work</h1>
            <p className="text-sm text-gray-500">Everything waiting on you, across every module.</p>
          </div>
        </div>
        <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
          {workspaces.length === 0 && <option value="">No workspaces</option>}
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-16">Loading…</div>
      ) : !data ? (
        <div className="text-center text-gray-500 py-16">Could not load your work.</div>
      ) : (
        <div className="space-y-6">
          {/* Approvals awaiting me */}
          <Section
            icon={<CheckCircle2 className="h-4 w-4 text-blue-600" />}
            title={`Approvals to decide (${data.approvalsToDecide.length})`}
          >
            {data.approvalsToDecide.length === 0 ? (
              <Empty text="Nothing awaiting your approval." />
            ) : data.approvalsToDecide.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-gray-900 capitalize">{subjectLabel(a.subjectType)}</span>
                  <span className="ml-2 text-xs text-gray-400">requested {fmt(a.createdAt)}</span>
                  {a.overdue && <span className="ml-2 text-xs font-medium text-red-600">SLA overdue</span>}
                </div>
                <button onClick={() => decide(a.id, "approved")} disabled={deciding === a.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-medium rounded-md">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                </button>
                <button onClick={() => decide(a.id, "rejected")} disabled={deciding === a.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 text-gray-700 text-xs font-medium rounded-md">
                  <XCircle className="h-3.5 w-3.5" /> Reject
                </button>
              </div>
            ))}
          </Section>

          {/* My pending requests */}
          <Section icon={<Send className="h-4 w-4 text-blue-600" />} title={`My pending requests (${data.myRequests.length})`}>
            {data.myRequests.length === 0 ? (
              <Empty text="No requests waiting on others." />
            ) : data.myRequests.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
                <span className="text-sm text-gray-900 capitalize">{subjectLabel(r.subjectType)}</span>
                <span className="text-xs text-gray-400">step {r.currentStep} · submitted {fmt(r.createdAt)}</span>
              </div>
            ))}
          </Section>

          {/* My open inspections */}
          <Section icon={<ClipboardList className="h-4 w-4 text-blue-600" />} title={`My open inspections (${data.openInspections.length})`}>
            {data.openInspections.length === 0 ? (
              <Empty text="No inspections in progress." />
            ) : data.openInspections.map((i) => (
              <Link key={i.id} href={`/dashboard/inspections/${i.id}`} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <span className="text-sm text-gray-900 flex-1 truncate">{i.title}</span>
                <span className="text-xs text-gray-400">{fmt(i.createdAt)}</span>
              </Link>
            ))}
          </Section>

          {/* Unread notifications */}
          <Section icon={<Bell className="h-4 w-4 text-blue-600" />} title={`Unread notifications (${data.unread.length})`}>
            {data.unread.length === 0 ? (
              <Empty text="All caught up." />
            ) : data.unread.map((n) => (
              <div key={n.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                <div className="text-sm text-gray-900">{n.title}</div>
                {n.body && <div className="text-xs text-gray-500 mt-0.5">{n.body}</div>}
              </div>
            ))}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        {icon}
        <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-6 text-center text-sm text-gray-400">{text}</div>;
}
