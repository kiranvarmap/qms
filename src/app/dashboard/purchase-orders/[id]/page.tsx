"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, CheckCircle2, PackageCheck, X, AlertCircle } from "lucide-react";
import { DocLinesEditor } from "@/components/shared/doc-lines-editor";
import { AttachmentsSection } from "@/components/shared/attachments-section";

interface Line {
  id: string;
  description: string;
  quantity: number;
  qtyReceived: number;
  unitCostMinor: number;
  amountMinor: number;
  lineTaxMinor: number;
}
interface Receipt { id: string; docNumber: string; receivedAt: string; notes: string | null }
interface PO {
  id: string;
  workspaceId: string;
  docNumber: string;
  status: string;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  expectedDate: string | null;
  notes: string | null;
  vendor: { id: string; name: string } | null;
  lines: Line[];
  receipts: Receipt[];
}
interface Warehouse { id: string; name: string }

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

function money(minor: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export default function PurchaseOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<PO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showReceive, setShowReceive] = useState(false);
  const [receiveQty, setReceiveQty] = useState<Record<string, string>>({});
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/purchase-orders/${id}`);
    const data = res.ok ? await res.json() : null;
    setPo(data);
    if (data?.workspaceId) {
      const w = await fetch(`/api/warehouses?workspaceId=${data.workspaceId}`).then((r) => r.json()).catch(() => ({}));
      const list: Warehouse[] = Array.isArray(w.data) ? w.data : [];
      setWarehouses(list);
      setWarehouseId((prev) => prev || list[0]?.id || "");
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const act = async (path: string, body?: unknown) => {
    setBusy(true); setError("");
    const res = await fetch(`/api/purchase-orders/${id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Action failed"); return false; }
    return true;
  };

  const submitReceive = async () => {
    const lines = Object.entries(receiveQty)
      .map(([poLineItemId, q]) => ({ poLineItemId, quantity: Number(q) || 0 }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) { setError("Enter at least one received quantity"); return; }
    if (await act("receive", { lines, warehouseId: warehouseId || undefined })) {
      setShowReceive(false); setReceiveQty({}); load();
    }
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!po) return <div className="p-8 text-gray-500">Purchase order not found.</div>;

  const canReceive = ["approved", "sent", "partially_received"].includes(po.status);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard/purchase-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Purchase Orders
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{po.docNumber}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[po.status] ?? ""}`}>
              {po.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{po.vendor?.name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          {po.status === "draft" && (
            <DocLinesEditor endpoint={`/api/purchase-orders/${po.id}`} lines={po.lines} priceField="unitCost" currency={po.currency} onSaved={load} />
          )}
          {po.status === "draft" && (
            <button onClick={async () => (await act("submit")) && load()} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-md">
              <Send className="h-4 w-4" /> Submit for approval
            </button>
          )}
          {po.status === "approved" && (
            <button onClick={async () => (await act("send")) && load()} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-md">
              <CheckCircle2 className="h-4 w-4" /> Mark sent
            </button>
          )}
          {canReceive && (
            <button onClick={() => setShowReceive(true)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-md">
              <PackageCheck className="h-4 w-4" /> Receive
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-500/10 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium text-right">Qty</th>
              <th className="px-4 py-2.5 font-medium text-right">Received</th>
              <th className="px-4 py-2.5 font-medium text-right">Unit</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-200">
                <td className="px-4 py-2.5 text-gray-900">{l.description}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{l.quantity}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{l.qtyReceived}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{money(l.unitCostMinor, po.currency)}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{money(l.amountMinor + l.lineTaxMinor, po.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8">
        <div className="w-56 text-sm space-y-1">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{money(po.subtotalMinor, po.currency)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Tax</span><span>{money(po.taxMinor, po.currency)}</span></div>
          <div className="flex justify-between text-gray-900 font-medium border-t border-gray-200 pt-1"><span>Total</span><span>{money(po.totalMinor, po.currency)}</span></div>
        </div>
      </div>

      {po.receipts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Goods Receipts</h2>
          <div className="space-y-1">
            {po.receipts.map((r) => (
              <div key={r.id} className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm flex justify-between">
                <span className="text-gray-900">{r.docNumber}</span>
                <span className="text-gray-500">{new Date(r.receivedAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showReceive && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowReceive(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Receive Goods</h2>
              <button onClick={() => setShowReceive(false)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <label className="block mb-3">
              <span className="text-xs text-gray-500">Receive into warehouse</span>
              <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900">
                <option value="">— none (no stock update) —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <div className="space-y-2">
              {po.lines.filter((l) => l.qtyReceived < l.quantity).map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900 truncate">{l.description}</div>
                    <div className="text-xs text-gray-500">{l.qtyReceived} / {l.quantity} received</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={l.quantity - l.qtyReceived}
                    placeholder="0"
                    value={receiveQty[l.id] ?? ""}
                    onChange={(e) => setReceiveQty((q) => ({ ...q, [l.id]: e.target.value }))}
                    className="w-24 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-sm text-gray-900"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowReceive(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={submitReceive} disabled={busy} className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">
                {busy ? "Saving…" : "Confirm receipt"}
              </button>
            </div>
          </div>
        </div>
      )}

      {po && <AttachmentsSection workspaceId={po.workspaceId} refType="purchase_order" refId={po.id} />}
    </div>
  );
}
