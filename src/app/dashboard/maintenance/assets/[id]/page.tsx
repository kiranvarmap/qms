"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench, CalendarClock, Activity } from "lucide-react";

interface Order { id: string; number: string; type: string; status: string; priority: string; fault: string | null; scheduledDate: string | null; createdAt: string }
interface Schedule { id: string; name: string; intervalDays: number; nextDue: string | null; isActive: boolean }
interface Feed { id: string; action: string; summary: string | null; occurredAt: string }
interface AssetDetail {
  id: string; code: string | null; name: string; type: string | null; location: string | null;
  status: string; criticality: string; warrantyUntil: string | null;
  orders: Order[]; schedules: Schedule[]; activity: Feed[];
}

const statusBadge: Record<string, string> = {
  up: "bg-green-100 text-green-700",
  down: "bg-red-100 text-red-700",
  maintenance: "bg-amber-100 text-amber-700",
  retired: "bg-gray-100 text-gray-500",
};
const orderBadge: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  on_hold: "bg-gray-100 text-gray-600",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-gray-100 text-gray-500",
};

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString() : "—");

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/assets/${id}`);
    setAsset(res.ok ? await res.json() : null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const changeStatus = async (status: string) => {
    await fetch(`/api/assets/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!asset) return <div className="p-8 text-gray-500">Asset not found.</div>;

  const downtimeEvents = asset.activity.filter((a) => a.action === "asset_status_changed").length;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/maintenance/assets" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Assets</Link>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wrench className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{asset.name}{asset.code ? <span className="ml-2 text-sm text-gray-400 font-mono">{asset.code}</span> : null}</h1>
            <p className="text-sm text-gray-500">{[asset.type, asset.location].filter(Boolean).join(" · ") || "—"} · criticality {asset.criticality}</p>
          </div>
        </div>
        <select value={asset.status} onChange={(e) => changeStatus(e.target.value)} className={`rounded-full px-2.5 py-1 text-xs font-medium border-0 ${statusBadge[asset.status] || "bg-gray-100"}`}>
          <option value="up">up</option>
          <option value="down">down</option>
          <option value="maintenance">maintenance</option>
          <option value="retired">retired</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Kpi label="Maintenance orders" value={String(asset.orders.length)} />
        <Kpi label="Open orders" value={String(asset.orders.filter((o) => o.status === "open" || o.status === "in_progress").length)} />
        <Kpi label="Status changes" value={String(downtimeEvents)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maintenance history */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-700">Maintenance history</h2>
          </div>
          {asset.orders.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">No maintenance orders yet.</div>
          ) : asset.orders.map((o) => (
            <div key={o.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-900 font-medium">{o.number}</span>
                <span className="text-xs text-gray-400 capitalize">{o.type}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${orderBadge[o.status] || "bg-gray-100"}`}>{o.status.replace(/_/g, " ")}</span>
              </div>
              {o.fault && <div className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-line">{o.fault}</div>}
              <div className="text-[11px] text-gray-400 mt-1">{fmt(o.scheduledDate ?? o.createdAt)}</div>
            </div>
          ))}
        </div>

        <div className="space-y-6">
          {/* PM schedules */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-gray-700">PM schedules</h2>
              </div>
              <Link href="/dashboard/maintenance/pm-schedules" className="text-xs text-blue-600 hover:underline">Manage</Link>
            </div>
            {asset.schedules.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No preventive schedules.</div>
            ) : asset.schedules.map((s) => (
              <div key={s.id} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center gap-2">
                <span className="text-sm text-gray-900">{s.name}</span>
                <span className="text-xs text-gray-400">{s.intervalDays > 0 ? `every ${s.intervalDays}d` : "one-shot"}</span>
                <span className="ml-auto text-xs text-gray-500">next {fmt(s.nextDue)}</span>
                {!s.isActive && <span className="text-[11px] text-gray-400">(paused)</span>}
              </div>
            ))}
          </div>

          {/* Activity */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-semibold text-gray-700">Activity</h2>
            </div>
            {asset.activity.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">No recorded activity.</div>
            ) : asset.activity.map((a) => (
              <div key={a.id} className="px-4 py-2.5 border-b border-gray-100 last:border-0 flex items-center gap-2">
                <span className="text-sm text-gray-700">{a.summary ?? a.action.replace(/_/g, " ")}</span>
                <span className="ml-auto text-[11px] text-gray-400">{fmt(a.occurredAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold mt-0.5 text-gray-900">{value}</div>
    </div>
  );
}
