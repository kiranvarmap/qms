"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowLeft, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Customer { id: string; name: string }
interface TaxRate { id: string; name: string; rateBasisPoints: number }
interface Line { description: string; quantity: string; unitPrice: string; taxRateId: string }

const emptyLine: Line = { description: "", quantity: "1", unitPrice: "0", taxRateId: "" };

export default function NewInvoicePage() {
  const router = useRouter();
  const [workspaceId, setWorkspaceId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ws = new URLSearchParams(window.location.search).get("workspaceId") ?? "";
    setWorkspaceId(ws); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const loadRefs = useCallback(async () => {
    if (!workspaceId) return;
    const [c, t] = await Promise.all([
      fetch(`/api/customers?workspaceId=${workspaceId}&status=active`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/tax-rates?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
    ]);
    setCustomers(Array.isArray(c.data) ? c.data : []);
    setTaxRates(Array.isArray(t.data) ? t.data : []);
  }, [workspaceId]);

  useEffect(() => { loadRefs(); }, [loadRefs]); // eslint-disable-line react-hooks/set-state-in-effect

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { ...emptyLine }]);
  const removeLine = (i: number) => setLines((ls) => (ls.length > 1 ? ls.filter((_, idx) => idx !== i) : ls));

  const grandTotal = lines.reduce((acc, l) => {
    const net = (Number(l.quantity) || 0) * (Number(l.unitPrice) || 0);
    const bp = taxRates.find((t) => t.id === l.taxRateId)?.rateBasisPoints ?? 0;
    return acc + net + (net * bp) / 10000;
  }, 0);

  const save = async () => {
    if (!customerId) { setError("Select a customer"); return; }
    if (lines.some((l) => !l.description.trim())) { setError("Every line needs a description"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        customerId,
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity) || 0,
          unitPrice: Number(l.unitPrice) || 0,
          taxRateId: l.taxRateId || undefined,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to create"); return; }
    const inv = await res.json();
    router.push(`/dashboard/invoices/${inv.id}`);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard/invoices" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Invoices
      </Link>
      <h1 className="text-xl font-semibold text-gray-900 mb-6">New Invoice</h1>

      {error && <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-500/10 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <label className="block">
          <span className="text-xs text-gray-500">Customer *</span>
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900">
            <option value="">Select…</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Due date</span>
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" />
        </label>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 font-medium w-20">Qty</th>
              <th className="px-3 py-2 font-medium w-28">Unit price</th>
              <th className="px-3 py-2 font-medium w-36">Tax</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="px-3 py-2"><input value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Item or service" className="w-full bg-transparent text-gray-900 outline-none" /></td>
                <td className="px-3 py-2"><input type="number" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} className="w-full bg-transparent text-gray-900 outline-none" /></td>
                <td className="px-3 py-2"><input type="number" step="0.01" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: e.target.value })} className="w-full bg-transparent text-gray-900 outline-none" /></td>
                <td className="px-3 py-2">
                  <select value={l.taxRateId} onChange={(e) => setLine(i, { taxRateId: e.target.value })} className="w-full bg-transparent text-gray-700 outline-none">
                    <option value="" className="bg-white">None</option>
                    {taxRates.map((t) => <option key={t.id} value={t.id} className="bg-white">{t.name} ({(t.rateBasisPoints / 100).toFixed(2)}%)</option>)}
                  </select>
                </td>
                <td className="px-3 py-2 text-right"><button onClick={() => removeLine(i)} className="p-1 text-gray-500 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mb-6">
        <button onClick={addLine} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-600"><Plus className="h-4 w-4" /> Add line</button>
        <div className="text-sm text-gray-600">Total: <span className="text-gray-900 font-medium">${grandTotal.toFixed(2)}</span></div>
      </div>

      <label className="block mb-6">
        <span className="text-xs text-gray-500">Notes</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900" />
      </label>

      <div className="flex justify-end gap-2">
        <Link href="/dashboard/invoices" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</Link>
        <button onClick={save} disabled={saving || !workspaceId} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Creating…" : "Create draft"}</button>
      </div>
    </div>
  );
}
