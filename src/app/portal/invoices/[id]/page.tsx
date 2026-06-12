"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft } from "@vibe/icons";

interface Line { id: string; description: string; quantity: number; unitPriceMinor: number; amountMinor: number; lineTaxMinor: number }
interface Invoice {
  id: string; docNumber: string; status: string; currency: string;
  subtotalMinor: number; taxMinor: number; totalMinor: number; amountPaidMinor: number; dueDate: string | null; lines: Line[];
}

function money(minor: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export default function PortalInvoicePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inv, setInv] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/portal/invoices/${id}`);
    if (res.status === 401) { router.push("/portal/login"); return; }
    setInv(res.ok ? await res.json() : null);
    setLoading(false);
  }, [id, router]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!inv) return <div className="p-8 text-gray-500">Invoice not found.</div>;

  const balance = inv.totalMinor - inv.amountPaidMinor;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <Link href="/portal" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Back</Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold">{inv.docNumber}</h1>
        <p className="text-sm text-gray-500 mt-1">Status: {inv.status.replace(/_/g, " ")}{inv.dueDate ? ` · due ${new Date(inv.dueDate).toLocaleDateString()}` : ""}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-100">
            <th className="px-4 py-2.5 font-medium">Description</th>
            <th className="px-4 py-2.5 font-medium text-right">Qty</th>
            <th className="px-4 py-2.5 font-medium text-right">Unit price</th>
            <th className="px-4 py-2.5 font-medium text-right">Amount</th>
          </tr></thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.id} className="border-b border-gray-50">
                <td className="px-4 py-2.5">{l.description}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{l.quantity}</td>
                <td className="px-4 py-2.5 text-right text-gray-500">{money(l.unitPriceMinor, inv.currency)}</td>
                <td className="px-4 py-2.5 text-right">{money(l.amountMinor + l.lineTaxMinor, inv.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-60 text-sm space-y-1">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>{money(inv.subtotalMinor, inv.currency)}</span></div>
          <div className="flex justify-between text-gray-500"><span>Tax</span><span>{money(inv.taxMinor, inv.currency)}</span></div>
          <div className="flex justify-between font-semibold border-t border-gray-200 pt-1"><span>Total</span><span>{money(inv.totalMinor, inv.currency)}</span></div>
          <div className="flex justify-between text-gray-500"><span>Paid</span><span>{money(inv.amountPaidMinor, inv.currency)}</span></div>
          <div className="flex justify-between font-semibold"><span>Balance due</span><span>{money(balance, inv.currency)}</span></div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-6">To pay, please contact us — payments are processed offline.</p>
    </div>
  );
}
