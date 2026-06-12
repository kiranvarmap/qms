"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, CreditCard, Upload, Link as Link2 } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Expense { id: string; docNumber: string; amountMinor: number }
interface Txn { id: string; description: string | null; amountMinor: number; last4: string | null; status: string; matchedExpenseId: string | null; }

export default function CardImportPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [txns, setTxns] = useState<Txn[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [csv, setCsv] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [tx, ex] = await Promise.all([
      fetch(`/api/card-transactions?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/expenses?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({ data: [] })),
    ]);
    setTxns(tx.data ?? []);
    setExpenses(ex.data ?? []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  // CSV: "description, amount, last4" per line.
  const importCsv = async () => {
    const transactions = csv.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
      const [description, amount, last4] = l.split(",").map((s) => s.trim());
      return { description, amount: Number(amount) || 0, last4 };
    }).filter((t) => t.amount);
    if (transactions.length === 0) return;
    setBusy(true);
    await fetch("/api/card-transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, transactions }) });
    setBusy(false); setCsv(""); load();
  };
  const match = async (id: string, expenseId: string) => { if (!expenseId) return; await fetch(`/api/card-transactions/${id}/match`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expenseId }) }); load(); };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/expenses" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Expenses</Link>
      <div className="flex items-center gap-3 mb-6"><CreditCard className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Corporate Card Import</h1></div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm mb-6">
        <div className="text-sm font-medium text-gray-900 mb-2">Paste transactions (CSV: description, amount, last4)</div>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} placeholder="Uber, 24.50, 4321&#10;Hotel, 180.00, 4321" className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 font-mono" />
        <div className="mt-2 flex justify-end"><button onClick={importCsv} disabled={busy} className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md inline-flex items-center gap-1.5"><Upload className="h-4 w-4" /> Import</button></div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Description</th><th className="px-4 py-3 font-medium">Card</th><th className="px-4 py-3 font-medium text-right">Amount</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Match</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : txns.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No transactions imported.</td></tr>
            : txns.map((t) => (
              <tr key={t.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900">{t.description || "—"}</td>
                <td className="px-4 py-3 text-gray-500">{t.last4 ? `••${t.last4}` : "—"}</td>
                <td className="px-4 py-3 text-right text-gray-900">{(t.amountMinor / 100).toFixed(2)}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${t.status === "matched" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{t.status}</span></td>
                <td className="px-4 py-3">
                  {t.status === "matched" ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><Link2 className="h-3.5 w-3.5" /> linked</span>
                  : <NativeSelect onChange={(e) => match(t.id, e.target.value)} defaultValue="" className="bg-white border border-gray-300 rounded-md px-2 py-1 text-xs text-gray-900"><option value="">Match to expense…</option>{expenses.map((x) => <option key={x.id} value={x.id}>{x.docNumber} · {(x.amountMinor / 100).toFixed(2)}</option>)}</NativeSelect>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
