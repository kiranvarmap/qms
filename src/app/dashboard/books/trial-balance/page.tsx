"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, ScrollText } from "lucide-react";

interface Workspace { id: string; name: string }
interface Row { accountId: string; code: string; name: string; type: string; debit: number; credit: number; balanceMinor: number; }

export default function TrialBalancePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await fetch(`/api/reports/trial-balance?workspaceId=${workspaceId}`);
    const data = await res.json();
    setRows(res.ok ? (data.data ?? []) : []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const totDr = rows.reduce((s, r) => s + r.debit, 0);
  const totCr = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard/books/journal" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Journal</Link>
      <div className="flex items-center gap-3 mb-6"><ScrollText className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Trial Balance</h1></div>
      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Account</th><th className="px-4 py-3 font-medium text-right">Debit</th><th className="px-4 py-3 font-medium text-right">Credit</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No accounts / postings.</td></tr>
            : rows.map((r) => (
              <tr key={r.accountId} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900"><span className="text-gray-400 font-mono text-xs">{r.code}</span> {r.name}</td>
                <td className="px-4 py-3 text-right text-gray-700">{r.debit ? (r.debit / 100).toFixed(2) : "—"}</td>
                <td className="px-4 py-3 text-right text-gray-700">{r.credit ? (r.credit / 100).toFixed(2) : "—"}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr className="border-t border-gray-200 font-semibold text-gray-900"><td className="px-4 py-3">Total {totDr === totCr ? "✓" : "✗ (out of balance)"}</td><td className="px-4 py-3 text-right">{(totDr / 100).toFixed(2)}</td><td className="px-4 py-3 text-right">{(totCr / 100).toFixed(2)}</td></tr></tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
