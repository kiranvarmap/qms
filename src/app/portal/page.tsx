"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Doc as FileText, Doc as Receipt } from "@vibe/icons";

interface Est { id: string; docNumber: string; status: string; totalMinor: number; currency: string; validUntil: string | null }
interface Inv { id: string; docNumber: string; status: string; totalMinor: number; amountPaidMinor: number; currency: string; dueDate: string | null }

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}
const badge = "px-2 py-0.5 rounded text-xs font-medium";
const estBadge: Record<string, string> = {
  sent: "bg-indigo-100 text-indigo-700", viewed: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700", converted: "bg-purple-100 text-purple-700",
};
const invBadge: Record<string, string> = {
  sent: "bg-indigo-100 text-indigo-700", partially_paid: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700", overdue: "bg-red-100 text-red-700",
};

export default function PortalDashboard() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [estimates, setEstimates] = useState<Est[]>([]);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const me = await fetch("/api/portal/me");
    if (!me.ok) { router.push("/portal/login"); return; }
    const meData = await me.json();
    setCustomerName(meData.customer?.name ?? "");
    const [e, i] = await Promise.all([
      fetch("/api/portal/estimates").then((r) => r.json()).catch(() => ({})),
      fetch("/api/portal/invoices").then((r) => r.json()).catch(() => ({})),
    ]);
    setEstimates(Array.isArray(e.data) ? e.data : []);
    setInvoices(Array.isArray(i.data) ? i.data : []);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const logout = async () => {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.push("/portal/login");
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-semibold">{customerName || "Customer Portal"}</h1>
          <p className="text-sm text-gray-500">Your estimates and invoices</p>
        </div>
        <button onClick={logout} className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900"><LogOut className="h-4 w-4" /> Sign out</button>
      </div>

      <section className="mb-10">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3"><FileText className="h-4 w-4" /> Estimates</h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {estimates.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No estimates.</p>
          ) : estimates.map((e) => (
            <Link key={e.id} href={`/portal/estimates/${e.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="font-medium text-blue-600">{e.docNumber}</span>
                <span className={`${badge} ${estBadge[e.status] ?? "bg-gray-100 text-gray-600"}`}>{e.status}</span>
              </div>
              <span className="text-gray-900">{money(e.totalMinor, e.currency)}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3"><Receipt className="h-4 w-4" /> Invoices</h2>
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100">
          {invoices.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-gray-400">No invoices.</p>
          ) : invoices.map((i) => (
            <Link key={i.id} href={`/portal/invoices/${i.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="font-medium text-blue-600">{i.docNumber}</span>
                <span className={`${badge} ${invBadge[i.status] ?? "bg-gray-100 text-gray-600"}`}>{i.status.replace(/_/g, " ")}</span>
              </div>
              <span className="text-gray-900">{money(i.totalMinor - i.amountPaidMinor, i.currency)} due</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
