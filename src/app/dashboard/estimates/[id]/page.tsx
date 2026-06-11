"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Send, CheckCircle2, XCircle, RotateCcw, AlertCircle, ArrowRightLeft, Download } from "lucide-react";
import { DocLinesEditor } from "@/components/shared/doc-lines-editor";

interface Line { id: string; description: string; quantity: number; unitPriceMinor: number; amountMinor: number; lineTaxMinor: number }
interface Version { id: string; version: number; createdAt: string }
interface Estimate {
  id: string; docNumber: string; status: string; version: number; currency: string;
  subtotalMinor: number; taxMinor: number; totalMinor: number; validUntil: string | null; notes: string | null;
  convertedToType: string | null;
  convertedToId: string | null;
  customer: { id: string; name: string } | null;
  lines: Line[]; versions: Version[];
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-600/40 text-gray-700",
  sent: "bg-indigo-500/20 text-indigo-600",
  viewed: "bg-blue-500/20 text-blue-600",
  accepted: "bg-green-500/20 text-green-600",
  rejected: "bg-red-500/20 text-red-600",
  expired: "bg-amber-500/20 text-amber-600",
  converted: "bg-purple-500/20 text-purple-600",
};

function money(minor: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export default function EstimateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [est, setEst] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/estimates/${id}`);
    setEst(res.ok ? await res.json() : null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const act = async (path: string) => {
    setBusy(true); setError("");
    const res = await fetch(`/api/estimates/${id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" } });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Action failed"); return; }
    load();
  };

  const convertToSalesOrder = async () => {
    setBusy(true); setError("");
    const res = await fetch(`/api/estimates/${id}/convert`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target: "sales_order" }),
    });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Convert failed"); return; }
    const data = await res.json();
    if (data.salesOrderId) router.push(`/dashboard/sales-orders/${data.salesOrderId}`);
    else load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!est) return <div className="p-8 text-gray-500">Estimate not found.</div>;

  const sendable = est.status === "draft";
  const decidable = ["sent", "viewed"].includes(est.status);
  const revisable = est.status !== "converted";

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard/estimates" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Estimates
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{est.docNumber}</h1>
            <span className="text-xs text-gray-500">v{est.version}</span>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[est.status] ?? ""}`}>{est.status}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{est.customer?.name ?? "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          {est.status === "draft" && (
            <DocLinesEditor
              endpoint={`/api/estimates/${est.id}`}
              lines={est.lines}
              priceField="unitPrice"
              currency={est.currency}
              onSaved={load}
            />
          )}
          <a href={`/api/estimates/${est.id}/pdf`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 hover:text-gray-900 text-xs font-medium rounded-md"><Download className="h-4 w-4" /> PDF</a>
          {sendable && <button onClick={() => act("send")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"><Send className="h-4 w-4" /> Send</button>}
          {decidable && <button onClick={() => act("accept")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"><CheckCircle2 className="h-4 w-4" /> Accept</button>}
          {decidable && <button onClick={() => act("reject")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium rounded-md"><XCircle className="h-4 w-4" /> Reject</button>}
          {est.status === "accepted" && !est.convertedToType && <button onClick={convertToSalesOrder} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"><ArrowRightLeft className="h-4 w-4" /> Convert to Sales Order</button>}
          {revisable && est.status !== "draft" && <button onClick={() => act("revise")} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 hover:text-gray-900 text-xs font-medium rounded-md"><RotateCcw className="h-4 w-4" /> Revise</button>}
        </div>
      </div>

      {est.convertedToType === "sales_order" && est.convertedToId && (
        <div className="mb-4 text-sm text-gray-700 bg-gray-50 rounded-md px-3 py-2">
          Converted to <Link href={`/dashboard/sales-orders/${est.convertedToId}`} className="text-blue-600 hover:underline">sales order</Link>.
        </div>
      )}
      {error && <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-500/10 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-4 py-2.5 font-medium">Description</th>
              <th className="px-4 py-2.5 font-medium text-right">Qty</th>
              <th className="px-4 py-2.5 font-medium text-right">Unit price</th>
              <th className="px-4 py-2.5 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {est.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-200">
                <td className="px-4 py-2.5 text-gray-900">{l.description}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{l.quantity}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{money(l.unitPriceMinor, est.currency)}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{money(l.amountMinor + l.lineTaxMinor, est.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8">
        <div className="w-56 text-sm space-y-1">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{money(est.subtotalMinor, est.currency)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Tax</span><span>{money(est.taxMinor, est.currency)}</span></div>
          <div className="flex justify-between text-gray-900 font-medium border-t border-gray-200 pt-1"><span>Total</span><span>{money(est.totalMinor, est.currency)}</span></div>
        </div>
      </div>

      {est.versions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Version history</h2>
          <div className="space-y-1">
            {est.versions.map((v) => (
              <div key={v.id} className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm flex justify-between">
                <span className="text-gray-700">Version {v.version}</span>
                <span className="text-gray-500">{new Date(v.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
