"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, DollarSign, X, AlertCircle, Download } from "lucide-react";

interface Line { id: string; description: string; quantity: number; unitPriceMinor: number; amountMinor: number; lineTaxMinor: number }
interface Payment { id: string; amountMinor: number; method: string; reference: string | null; receivedDate: string }
interface Invoice {
  id: string; docNumber: string; status: string; currency: string;
  subtotalMinor: number; taxMinor: number; totalMinor: number; amountPaidMinor: number;
  dueDate: string | null; notes: string | null;
  customer: { id: string; name: string } | null;
  lines: Line[]; payments: Payment[];
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-600/40 text-gray-700", sent: "bg-indigo-500/20 text-indigo-600",
  partially_paid: "bg-amber-500/20 text-amber-600", paid: "bg-green-500/20 text-green-600",
  overdue: "bg-red-500/20 text-red-600", void: "bg-gray-100/60 text-gray-500",
};

function money(minor: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPay, setShowPay] = useState(false);
  const [pay, setPay] = useState({ amount: "", method: "bank_transfer", reference: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/invoices/${id}`);
    setInv(res.ok ? await res.json() : null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const send = async () => {
    setBusy(true); setError("");
    const res = await fetch(`/api/invoices/${id}/send`, { method: "POST", headers: { "Content-Type": "application/json" } });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    load();
  };

  const recordPayment = async () => {
    const amount = Number(pay.amount);
    if (!amount || amount <= 0) { setError("Enter a valid amount"); return; }
    setBusy(true); setError("");
    const res = await fetch(`/api/invoices/${id}/payments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method: pay.method, reference: pay.reference.trim() || undefined }),
    });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowPay(false); setPay({ amount: "", method: "bank_transfer", reference: "" }); load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!inv) return <div className="p-8 text-gray-500">Invoice not found.</div>;

  const balance = inv.totalMinor - inv.amountPaidMinor;
  const canPay = ["sent", "partially_paid", "overdue"].includes(inv.status) && balance > 0;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard/invoices" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Invoices
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{inv.docNumber}</h1>
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[inv.status] ?? ""}`}>{inv.status.replace(/_/g, " ")}</span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{inv.customer?.name ?? "—"}{inv.dueDate ? ` · due ${new Date(inv.dueDate).toLocaleDateString()}` : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/api/invoices/${inv.id}/pdf`} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 hover:text-gray-900 text-xs font-medium rounded-md"><Download className="h-4 w-4" /> PDF</a>
          {inv.status === "draft" && <button onClick={send} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"><Send className="h-4 w-4" /> Send</button>}
          {canPay && <button onClick={() => setShowPay(true)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-xs font-medium rounded-md"><DollarSign className="h-4 w-4" /> Record payment</button>}
        </div>
      </div>

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
            {inv.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-200">
                <td className="px-4 py-2.5 text-gray-900">{l.description}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{l.quantity}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{money(l.unitPriceMinor, inv.currency)}</td>
                <td className="px-4 py-2.5 text-right text-gray-900">{money(l.amountMinor + l.lineTaxMinor, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end mb-8">
        <div className="w-60 text-sm space-y-1">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{money(inv.subtotalMinor, inv.currency)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Tax</span><span>{money(inv.taxMinor, inv.currency)}</span></div>
          <div className="flex justify-between text-gray-900 font-medium border-t border-gray-200 pt-1"><span>Total</span><span>{money(inv.totalMinor, inv.currency)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Paid</span><span>{money(inv.amountPaidMinor, inv.currency)}</span></div>
          <div className="flex justify-between text-gray-900 font-medium"><span>Balance due</span><span>{money(balance, inv.currency)}</span></div>
        </div>
      </div>

      {inv.payments.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Payments</h2>
          <div className="space-y-1">
            {inv.payments.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm flex justify-between">
                <span className="text-gray-900">{money(p.amountMinor, inv.currency)} <span className="text-gray-500">· {p.method.replace(/_/g, " ")}{p.reference ? ` · ${p.reference}` : ""}</span></span>
                <span className="text-gray-500">{new Date(p.receivedDate).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowPay(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
              <button onClick={() => setShowPay(false)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-gray-500 mb-3">Manual/offline record only — no card processing. Balance due {money(balance, inv.currency)}.</p>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Amount</span><input type="number" step="0.01" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <label className="block"><span className="text-xs text-gray-500">Method</span>
                <select value={pay.method} onChange={(e) => setPay({ ...pay, method: e.target.value })} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block"><span className="text-xs text-gray-500">Reference</span><input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowPay(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={recordPayment} disabled={busy} className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">{busy ? "Saving…" : "Record"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
