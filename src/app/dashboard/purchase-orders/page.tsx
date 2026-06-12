"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Add as Plus, Item as ShoppingCart } from "@vibe/icons";
import ImportExport from "@/components/ImportExport";

interface Workspace { id: string; name: string }
interface PoRow {
  id: string;
  docNumber: string;
  status: string;
  vendorName: string | null;
  totalMinor: number;
  currency: string;
  expectedDate: string | null;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-600/40 text-gray-700",
  pending_approval: "bg-yellow-500/20 text-yellow-600",
  approved: "bg-blue-500/20 text-blue-600",
  sent: "bg-indigo-500/20 text-indigo-600",
  partially_received: "bg-amber-500/20 text-amber-600",
  received: "bg-green-500/20 text-green-600",
  closed: "bg-gray-600/40 text-gray-600",
  cancelled: "bg-red-500/20 text-red-600",
};

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export default function PurchaseOrdersPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [rows, setRows] = useState<PoRow[]>([]);
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
    const res = await fetch(`/api/purchase-orders?workspaceId=${workspaceId}`);
    const data = await res.json();
    setRows(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ShoppingCart className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
        </div>
        <div className="flex items-center gap-2">
          <ImportExport entity="purchase-orders" workspaceId={workspaceId} canImport={false} />
          <Link
            href={workspaceId ? `/dashboard/purchase-orders/new?workspaceId=${workspaceId}` : "#"}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" /> New PO
          </Link>
        </div>
      </div>

      <NativeSelect
 value={workspaceId}
 onChange={(e) => setWorkspaceId(e.target.value)}
        className="mb-4 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900"
      >
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-4 py-3 font-medium">PO #</th>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Expected</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No purchase orders yet.</td></tr>
            ) : rows.map((po) => (
              <tr key={po.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/purchase-orders/${po.id}`} className="text-blue-600 hover:underline font-medium">
                    {po.docNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-700">{po.vendorName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[po.status] ?? ""}`}>
                    {po.status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-gray-900">{money(po.totalMinor, po.currency)}</td>
                <td className="px-4 py-3 text-gray-600">
                  {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
