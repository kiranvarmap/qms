"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, ClipboardList } from "lucide-react";
import ImportExport from "@/components/ImportExport";

interface Workspace { id: string; name: string }
interface SoRow {
  id: string; docNumber: string; status: string; customerName: string | null;
  totalMinor: number; currency: string; createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-600/40 text-gray-700",
  pending_approval: "bg-yellow-500/20 text-yellow-600",
  approved: "bg-blue-500/20 text-blue-600",
  reserved: "bg-cyan-500/20 text-cyan-600",
  picking: "bg-amber-500/20 text-amber-600",
  packed: "bg-amber-500/20 text-amber-600",
  shipped: "bg-indigo-500/20 text-indigo-600",
  delivered: "bg-green-500/20 text-green-600",
  invoiced: "bg-purple-500/20 text-purple-600",
  cancelled: "bg-red-500/20 text-red-600",
};

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export default function SalesOrdersPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [rows, setRows] = useState<SoRow[]>([]);
  const [loading, setLoading] = useState(true);

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
    const res = await fetch(`/api/sales-orders?workspaceId=${workspaceId}`);
    const data = await res.json();
    setRows(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Sales Orders</h1>
        </div>
        <div className="flex items-center gap-2">
          <ImportExport entity="sales-orders" workspaceId={workspaceId} canImport={false} />
          <Link href={workspaceId ? `/dashboard/sales-orders/new?workspaceId=${workspaceId}` : "#"} className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors">
            <Plus className="h-4 w-4" /> New Order
          </Link>
        </div>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-4 py-3 font-medium">Order #</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No sales orders yet.</td></tr>
            ) : rows.map((so) => (
              <tr key={so.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3"><Link href={`/dashboard/sales-orders/${so.id}`} className="text-blue-600 hover:underline font-medium">{so.docNumber}</Link></td>
                <td className="px-4 py-3 text-gray-700">{so.customerName ?? "—"}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[so.status] ?? ""}`}>{so.status.replace(/_/g, " ")}</span></td>
                <td className="px-4 py-3 text-right text-gray-900">{money(so.totalMinor, so.currency)}</td>
                <td className="px-4 py-3 text-gray-600">{new Date(so.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
