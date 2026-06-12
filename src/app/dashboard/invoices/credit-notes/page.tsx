"use client";

import { NativeSelect, useToast } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Doc as ReceiptText, Add as Plus, CloseSmall as X } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Customer { id: string; name: string }
interface Invoice { id: string; docNumber: string }
interface CN { id: string; docNumber: string; status: string; amountMinor: number; invoiceId: string | null; reason: string | null; }

const statusBadge: Record<string, string> = { draft: "bg-gray-100 text-gray-700", issued: "bg-blue-100 text-blue-700", applied: "bg-green-100 text-green-700" };

export default function CreditNotesPage() {
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoicesList, setInvoicesList] = useState<Invoice[]>([]);
  const [cns, setCns] = useState<CN[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ customerId: "", invoiceId: "", amount: "", reason: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [cn, cu, iv] = await Promise.all([
      fetch(`/api/credit-notes?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/customers?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/invoices?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setCns(cn.data ?? []); setCustomers(cu.data ?? []); setInvoicesList(iv.data ?? []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.amount) return;
    setSaving(true);
    await fetch("/api/credit-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, customerId: form.customerId || undefined, invoiceId: form.invoiceId || undefined, amount: Number(form.amount), reason: form.reason.trim() || undefined }) });
    setSaving(false); setShow(false); setForm({ customerId: "", invoiceId: "", amount: "", reason: "" }); load();
  };
  const apply = async (id: string) => { const res = await fetch(`/api/credit-notes/${id}/apply`, { method: "POST" }); if (!res.ok) { const e = await res.json().catch(() => ({})); toast(e.error || "Failed", "warning"); } load(); };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/invoices" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Invoices</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><ReceiptText className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Credit Notes</h1></div>
        <button onClick={() => setShow(true)} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Credit Note</button>
      </div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Number</th><th className="px-4 py-3 font-medium">Reason</th><th className="px-4 py-3 font-medium text-right">Amount</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium text-right">Actions</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : cns.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No credit notes yet.</td></tr>
            : cns.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{c.docNumber}</td>
                <td className="px-4 py-3 text-gray-700">{c.reason || "—"}</td>
                <td className="px-4 py-3 text-right text-gray-900">{(c.amountMinor / 100).toFixed(2)}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[c.status]}`}>{c.status}</span></td>
                <td className="px-4 py-3 text-right">{c.status === "issued" && c.invoiceId ? <button onClick={() => apply(c.id)} className="text-xs text-green-700 hover:underline">Apply to invoice</button> : <span className="text-gray-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Credit Note</h2><button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Customer</span><NativeSelect value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">—</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></label>
              <label className="block"><span className="text-xs text-gray-500">Apply to invoice (optional)</span><NativeSelect value={form.invoiceId} onChange={(e) => setForm({ ...form, invoiceId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">—</option>{invoicesList.map((i) => <option key={i.id} value={i.id}>{i.docNumber}</option>)}</NativeSelect></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Amount</span><input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
                <label className="block"><span className="text-xs text-gray-500">Reason</span><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5"><button onClick={() => setShow(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
