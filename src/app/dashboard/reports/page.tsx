"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import { Chart as BarChart3, CreditCard as DollarSign, Item as ShoppingCart, Item as Boxes, CheckList as ClipboardList, Group as Users, Academy as GraduationCap } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Summary {
  finance: { outstandingMinor: number; overdueCount: number; collectedMinor: number };
  procurement: { openPoCount: number; committedSpendMinor: number };
  inventory: { productCount: number; lowStockCount: number; stockValueMinor: number };
  sales: { openOrderCount: number; pipelineMinor: number };
  people: { pendingApprovals: number; pendingLeave: number; pendingExpenses: number; headcount: number };
  training: { certsExpiring: number; enrollmentsCompleted: number; enrollmentsTotal: number };
}

function money(minor: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(minor / 100);
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg px-4 py-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-xl font-semibold mt-0.5 ${accent ?? "text-gray-900"}`}>{value}</div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3"><Icon className="h-4 w-4 text-blue-600" /> {title}</h2>
      <div className="grid grid-cols-3 gap-3">{children}</div>
    </div>
  );
}

export default function ReportsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [data, setData] = useState<Summary | null>(null);
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
    const res = await fetch(`/api/reports/summary?workspaceId=${workspaceId}`);
    setData(res.ok ? await res.json() : null);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6"><BarChart3 className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Reports</h1></div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-6 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      {loading ? <p className="text-gray-500 text-sm">Loading…</p> : !data ? <p className="text-gray-500 text-sm">No data.</p> : (
        <div className="grid grid-cols-2 gap-5">
          <Section icon={DollarSign} title="Finance">
            <Stat label="AR outstanding" value={money(data.finance.outstandingMinor)} accent="text-amber-600" />
            <Stat label="Overdue invoices" value={data.finance.overdueCount} accent={data.finance.overdueCount ? "text-red-600" : "text-gray-900"} />
            <Stat label="Collected" value={money(data.finance.collectedMinor)} accent="text-green-600" />
          </Section>
          <Section icon={ShoppingCart} title="Procurement">
            <Stat label="Open POs" value={data.procurement.openPoCount} />
            <Stat label="Committed spend" value={money(data.procurement.committedSpendMinor)} />
            <Stat label="" value="" />
          </Section>
          <Section icon={Boxes} title="Inventory">
            <Stat label="Products" value={data.inventory.productCount} />
            <Stat label="Low stock" value={data.inventory.lowStockCount} accent={data.inventory.lowStockCount ? "text-amber-600" : "text-gray-900"} />
            <Stat label="Stock value" value={money(data.inventory.stockValueMinor)} />
          </Section>
          <Section icon={ClipboardList} title="Sales">
            <Stat label="Open orders" value={data.sales.openOrderCount} />
            <Stat label="Pipeline (estimates)" value={money(data.sales.pipelineMinor)} accent="text-blue-600" />
            <Stat label="" value="" />
          </Section>
          <Section icon={Users} title="People">
            <Stat label="Pending approvals" value={data.people.pendingApprovals} accent={data.people.pendingApprovals ? "text-amber-600" : "text-gray-900"} />
            <Stat label="Pending leave" value={data.people.pendingLeave} />
            <Stat label="Headcount" value={data.people.headcount} />
          </Section>
          <Section icon={GraduationCap} title="Training">
            <Stat label="Certs expiring" value={data.training.certsExpiring} accent={data.training.certsExpiring ? "text-red-600" : "text-gray-900"} />
            <Stat label="Completed" value={`${data.training.enrollmentsCompleted}/${data.training.enrollmentsTotal}`} />
            <Stat label="" value="" />
          </Section>
        </div>
      )}
    </div>
  );
}
