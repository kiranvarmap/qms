"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoveArrowLeft as ArrowLeft, Completed as CheckCircle2, CloseRound as XCircle, MoveArrowRight as Truck, Doc as Receipt, CloseSmall as X, Alert as AlertCircle } from "@vibe/icons";
import { DocLinesEditor } from "@/components/shared/doc-lines-editor";

interface Line {
  id: string; description: string; quantity: number; qtyReserved: number; qtyShipped: number;
  unitPriceMinor: number; amountMinor: number; lineTaxMinor: number;
}
interface Shipment { id: string; status: string; carrier: string | null; tracking: string | null; createdAt: string }
interface SO {
  id: string; docNumber: string; status: string; currency: string;
  subtotalMinor: number; taxMinor: number; totalMinor: number; notes: string | null;
  customer: { id: string; name: string } | null;
  lines: Line[]; shipments: Shipment[];
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-600/40 text-gray-700", pending_approval: "bg-yellow-500/20 text-yellow-600",
  approved: "bg-blue-500/20 text-blue-600", reserved: "bg-cyan-500/20 text-cyan-600",
  picking: "bg-amber-500/20 text-amber-600", packed: "bg-amber-500/20 text-amber-600",
  shipped: "bg-indigo-500/20 text-indigo-600", delivered: "bg-green-500/20 text-green-600",
  invoiced: "bg-purple-500/20 text-purple-600", cancelled: "bg-red-500/20 text-red-600",
};

function money(minor: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

const NEXT_ACTION: Record<string, { action: string; label: string } | null> = {
  pending: { action: "ship", label: "Ship" },
  picked: { action: "ship", label: "Ship" },
  packed: { action: "ship", label: "Ship" },
  shipped: { action: "deliver", label: "Mark delivered" },
  delivered: null,
};

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [so, setSo] = useState<SO | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showShip, setShowShip] = useState(false);
  const [shipQty, setShipQty] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/sales-orders/${id}`);
    setSo(res.ok ? await res.json() : null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const soAct = async (path: string) => {
    setBusy(true); setError("");
    const res = await fetch(`/api/sales-orders/${id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" } });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Action failed"); return; }
    load();
  };

  const shipmentAct = async (shipmentId: string, action: string) => {
    setBusy(true); setError("");
    const res = await fetch(`/api/shipments/${shipmentId}/transition`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Action failed"); return; }
    load();
  };

  const createShipment = async () => {
    const lines = Object.entries(shipQty)
      .map(([salesOrderLineId, q]) => ({ salesOrderLineId, quantity: Number(q) || 0 }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) { setError("Enter at least one quantity to ship"); return; }
    setBusy(true); setError("");
    const res = await fetch("/api/shipments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ salesOrderId: id, lines }),
    });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowShip(false); setShipQty({}); load();
  };

  const invoiceSO = async () => {
    setBusy(true); setError("");
    const res = await fetch(`/api/sales-orders/${id}/invoice`, { method: "POST", headers: { "Content-Type": "application/json" } });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    const data = await res.json();
    if (data.invoiceId) router.push(`/dashboard/invoices/${data.invoiceId}`);
    else load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!so) return <div className="p-8 text-gray-500">Sales order not found.</div>;

  const canApprove = so.status === "draft" || so.status === "pending_approval";
  const canCancel = !["shipped", "delivered", "invoiced", "cancelled"].includes(so.status);
  const canShip = ["reserved", "approved", "picking", "packed", "shipped"].includes(so.status) &&
    so.lines.some((l) => l.qtyShipped < l.quantity);
  const canInvoice = so.lines.some((l) => l.qtyShipped > 0);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard/sales-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Sales Orders
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{so.docNumber}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[so.status] ?? ""}`}>{so.status.replace(/_/g, " ")}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{so.customer?.name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          {so.status === "draft" && (
            <DocLinesEditor endpoint={`/api/sales-orders/${so.id}`} lines={so.lines} priceField="unitPrice" currency={so.currency} onSaved={load} />
          )}
          {canApprove && <button onClick={() => soAct("approve")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"><CheckCircle2 className="h-4 w-4" /> Approve & reserve</button>}
          {canShip && <button onClick={() => setShowShip(true)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"><Truck className="h-4 w-4" /> New shipment</button>}
          {canInvoice && <button onClick={invoiceSO} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"><Receipt className="h-4 w-4" /> Invoice shipped</button>}
          {canCancel && <button onClick={() => soAct("cancel")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 hover:text-gray-900 text-xs font-medium rounded-md"><XCircle className="h-4 w-4" /> Cancel</button>}
        </div>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-500/10 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium text-right">Ordered</th>
              <th className="px-4 py-2.5 font-medium text-right">Reserved</th>
              <th className="px-4 py-2.5 font-medium text-right">Shipped</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {so.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-200">
                <td className="px-4 py-2.5 text-gray-900">{l.description}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{l.quantity}</td>
                <td className="px-4 py-2.5 text-right text-cyan-600">{l.qtyReserved}</td>
                <td className="px-4 py-2.5 text-right text-indigo-600">{l.qtyShipped}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{money(l.amountMinor + l.lineTaxMinor, so.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8">
        <div className="w-56 text-sm space-y-1">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{money(so.subtotalMinor, so.currency)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Tax</span><span>{money(so.taxMinor, so.currency)}</span></div>
          <div className="flex justify-between text-gray-900 font-medium border-t border-gray-200 pt-1"><span>Total</span><span>{money(so.totalMinor, so.currency)}</span></div>
        </div>
      </div>

      {so.shipments.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Shipments</h2>
          <div className="space-y-1">
            {so.shipments.map((s) => {
              const next = NEXT_ACTION[s.status];
              return (
                <div key={s.id} className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s.status] ?? "bg-gray-100 text-gray-700"}`}>{s.status}</span>
                    <span className="text-gray-500">{new Date(s.createdAt).toLocaleDateString()}{s.tracking ? ` · ${s.tracking}` : ""}</span>
                  </div>
                  {next && <button onClick={() => shipmentAct(s.id, next.action)} disabled={busy} className="px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-50 text-white text-xs rounded-md">{next.label}</button>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showShip && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowShip(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">New Shipment</h2>
              <button onClick={() => setShowShip(false)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-2">
              {so.lines.filter((l) => l.qtyShipped < l.quantity).map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-gray-900 truncate">{l.description}</div>
                    <div className="text-xs text-gray-500">{l.qtyShipped} / {l.quantity} shipped</div>
                  </div>
                  <input type="number" min="0" max={l.quantity - l.qtyShipped} placeholder="0" value={shipQty[l.id] ?? ""} onChange={(e) => setShipQty((q) => ({ ...q, [l.id]: e.target.value }))} className="w-24 bg-gray-50 border border-gray-200 rounded-md px-2 py-1.5 text-sm text-gray-900" />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowShip(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={createShipment} disabled={busy} className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">{busy ? "Saving…" : "Create shipment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
