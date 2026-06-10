"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Users, FileText, ShoppingCart, Receipt, Pencil, X, AlertCircle } from "lucide-react";

interface DocRow { id: string; docNumber: string; status: string; totalMinor: number; createdAt: string; amountPaidMinor?: number; dueDate?: string | null }
interface Contact { id: string; firstName: string | null; lastName: string | null; email: string | null; workPhone: string | null; isPrimary: boolean }
interface CustomerDetail {
  id: string; name: string; email: string | null; phone: string | null; status: string; currency: string;
  contacts: Contact[];
  estimates: DocRow[]; salesOrders: DocRow[]; invoices: DocRow[];
  arOutstandingMinor: number; arOverdueMinor: number; lifetimeBilledMinor: number;
}

function money(minor: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

const fmt = (d: string) => new Date(d).toLocaleDateString();

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"invoices" | "orders" | "estimates" | "contacts">("invoices");
  const [showEdit, setShowEdit] = useState(false);
  const [edit, setEdit] = useState({ displayName: "", email: "", workPhone: "", status: "active", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/customers/${id}`);
    setC(res.ok ? await res.json() : null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const openEdit = () => {
    if (!c) return;
    setEdit({ displayName: c.name ?? "", email: c.email ?? "", workPhone: c.phone ?? "", status: c.status, notes: "" });
    setError("");
    setShowEdit(true);
  };

  const saveEdit = async () => {
    if (!edit.displayName.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await fetch(`/api/customers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: edit.displayName.trim(),
        email: edit.email.trim() || undefined,
        workPhone: edit.workPhone.trim() || undefined,
        status: edit.status as "active" | "inactive",
        ...(edit.notes.trim() ? { notes: edit.notes.trim() } : {}),
      }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to save"); return; }
    setShowEdit(false);
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!c) return <div className="p-8 text-gray-500">Customer not found.</div>;

  const tabs = [
    { key: "invoices" as const, label: `Invoices (${c.invoices.length})` },
    { key: "orders" as const, label: `Orders (${c.salesOrders.length})` },
    { key: "estimates" as const, label: `Estimates (${c.estimates.length})` },
    { key: "contacts" as const, label: `Contacts (${c.contacts.length})` },
  ];

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{c.name}</h1>
            <p className="text-sm text-gray-500">{c.email ?? "—"}{c.phone ? ` · ${c.phone}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{c.status}</span>
          <button onClick={openEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-medium rounded-md"><Pencil className="h-3.5 w-3.5" /> Edit</button>
        </div>
      </div>

      {/* AR summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Kpi label="Outstanding" value={money(c.arOutstandingMinor, c.currency)} accent={c.arOutstandingMinor > 0} />
        <Kpi label="Overdue" value={money(c.arOverdueMinor, c.currency)} danger={c.arOverdueMinor > 0} />
        <Kpi label="Lifetime billed" value={money(c.lifetimeBilledMinor, c.currency)} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "invoices" && <DocTable rows={c.invoices} currency={c.currency} href={(r) => `/dashboard/invoices/${r.id}`} icon={<Receipt className="h-4 w-4 text-gray-400" />} showBalance />}
      {tab === "orders" && <DocTable rows={c.salesOrders} currency={c.currency} href={(r) => `/dashboard/sales-orders/${r.id}`} icon={<ShoppingCart className="h-4 w-4 text-gray-400" />} />}
      {tab === "estimates" && <DocTable rows={c.estimates} currency={c.currency} href={(r) => `/dashboard/estimates/${r.id}`} icon={<FileText className="h-4 w-4 text-gray-400" />} />}
      {showEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEdit(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit customer</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Name *</span><input value={edit.displayName} onChange={(e) => setEdit({ ...edit, displayName: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Email</span><input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
                <label className="block"><span className="text-xs text-gray-500">Phone</span><input value={edit.workPhone} onChange={(e) => setEdit({ ...edit, workPhone: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              </div>
              <label className="block"><span className="text-xs text-gray-500">Status</span>
                <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
              <label className="block"><span className="text-xs text-gray-500">Notes</span><textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowEdit(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={saveEdit} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {tab === "contacts" && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
          {c.contacts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No contact persons.</div>
          ) : c.contacts.map((ct) => (
            <div key={ct.id} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
              <span className="text-sm text-gray-900">{[ct.firstName, ct.lastName].filter(Boolean).join(" ") || "—"}</span>
              {ct.isPrimary && <span className="text-[11px] font-medium text-blue-600 bg-blue-50 rounded px-1.5 py-0.5">primary</span>}
              <span className="ml-auto text-xs text-gray-500">{ct.email ?? ""}{ct.workPhone ? ` · ${ct.workPhone}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, accent, danger }: { label: string; value: string; accent?: boolean; danger?: boolean }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${danger ? "text-red-600" : accent ? "text-blue-700" : "text-gray-900"}`}>{value}</div>
    </div>
  );
}

function DocTable({ rows, currency, href, icon, showBalance }: {
  rows: DocRow[]; currency: string; href: (r: DocRow) => string; icon: React.ReactNode; showBalance?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="bg-white border border-gray-200 rounded-lg px-4 py-8 text-center text-sm text-gray-400 shadow-sm">Nothing here yet.</div>;
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-2.5 font-medium">Document</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="px-4 py-2.5 font-medium">Date</th>
            <th className="px-4 py-2.5 font-medium text-right">Total</th>
            {showBalance && <th className="px-4 py-2.5 font-medium text-right">Balance</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
              <td className="px-4 py-2.5">
                <Link href={href(r)} className="inline-flex items-center gap-2 text-blue-700 hover:underline">{icon}{r.docNumber}</Link>
              </td>
              <td className="px-4 py-2.5 text-gray-600 capitalize">{r.status.replace(/_/g, " ")}</td>
              <td className="px-4 py-2.5 text-gray-500">{fmt(r.createdAt)}</td>
              <td className="px-4 py-2.5 text-right text-gray-900">{money(r.totalMinor, currency)}</td>
              {showBalance && (
                <td className="px-4 py-2.5 text-right text-gray-900">
                  {money(r.totalMinor - (r.amountPaidMinor ?? 0), currency)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
