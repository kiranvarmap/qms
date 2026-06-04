"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X, AlertCircle } from "lucide-react";

interface Line { id: string; description: string; quantity: number; unitPriceMinor: number; amountMinor: number; lineTaxMinor: number }
interface Estimate {
  id: string; docNumber: string; status: string; currency: string;
  subtotalMinor: number; taxMinor: number; totalMinor: number; validUntil: string | null; notes: string | null; lines: Line[];
}

function money(minor: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export default function PortalEstimatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [est, setEst] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/portal/estimates/${id}`);
    if (res.status === 401) { router.push("/portal/login"); return; }
    setEst(res.ok ? await res.json() : null);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const decide = async (action: "accept" | "reject") => {
    setBusy(true); setError("");
    const res = await fetch(`/api/portal/estimates/${id}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" } });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Action failed"); return; }
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!est) return <div className="p-8 text-gray-500">Estimate not found.</div>;

  const decidable = ["sent", "viewed"].includes(est.status);

  return (
    <div className="max-w-3xl mx-auto p-8">
      <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Back</Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{est.docNumber}</h1>
          <p className="text-sm text-gray-500 mt-1">Status: {est.status}{est.validUntil ? ` · valid until ${new Date(est.validUntil).toLocaleDateString()}` : ""}</p>
        </div>
        {decidable && (
          <div className="flex items-center gap-2">
            <button onClick={() => decide("accept")} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Check className="h-4 w-4" /> Accept</button>
            <button onClick={() => decide("reject")} disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 hover:bg-gray-100 text-sm font-medium rounded-md"><X className="h-4 w-4" /> Decline</button>
          </div>
        )}
      </div>

      {est.status === "accepted" && <div className="mb-4 text-sm text-green-700 bg-green-50 rounded-md px-3 py-2">You accepted this estimate. Thank you!</div>}
      {error && <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="px-4 py-2.5 font-medium">Description</th>
            <th className="px-4 py-2.5 font-medium text-right">Qty</th>
            <th className="px-4 py-2.5 font-medium text-right">Unit price</th>
            <th className="px-4 py-2.5 font-medium text-right">Amount</th>
          </tr></thead>
          <tbody>
            {est.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-50">
                <td className="px-4 py-2.5">{l.description}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{l.quantity}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{money(l.unitPriceMinor, est.currency)}</td>
                <td className="px-4 py-2.5 text-right">{money(l.amountMinor + l.lineTaxMinor, est.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-56 text-sm space-y-1">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{money(est.subtotalMinor, est.currency)}</span></div>
          <div className="flex justify-between text-gray-500"><span>Tax</span><span>{money(est.taxMinor, est.currency)}</span></div>
          <div className="flex justify-between font-semibold border-t border-gray-200 pt-1"><span>Total</span><span>{money(est.totalMinor, est.currency)}</span></div>
        </div>
      </div>
    </div>
  );
}
