"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Wallet, Send, DollarSign } from "lucide-react";
import ImportExport from "@/components/ImportExport";

interface Workspace { id: string; name: string }
interface Expense {
  id: string; docNumber: string; status: string; amountMinor: number; currency: string;
  spentAt: string; description: string | null; employeeName: string | null; categoryName: string | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-600/40 text-gray-700",
  submitted: "bg-yellow-500/20 text-yellow-600",
  approved: "bg-blue-500/20 text-blue-600",
  rejected: "bg-red-500/20 text-red-600",
  reimbursed: "bg-green-500/20 text-green-600",
};

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

export default function ExpensesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data: Workspace[]) => {
        setWorkspaces(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setWorkspaceId(data[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const e = await fetch(`/api/expenses?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({}));
    setRows(Array.isArray(e.data) ? e.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const act = async (expenseId: string, action: "submit" | "reimburse") => {
    const body = action === "reimburse" ? { method: "bank_transfer" } : {};
    const res = await fetch(`/api/expenses/${expenseId}/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) load();
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Wallet className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Expenses</h1>
        </div>
        <div className="flex items-center gap-2">
          <ImportExport entity="expenses" workspaceId={workspaceId} canImport={false} />
          <Link
            href={workspaceId ? `/dashboard/expenses/new?workspaceId=${workspaceId}` : "/dashboard/expenses/new"}
            className={`flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md ${!workspaceId ? "pointer-events-none opacity-50" : ""}`}
          >
            <Plus className="h-4 w-4" /> New Expense
          </Link>
        </div>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-4 py-3 font-medium">Expense #</th>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No expenses yet.</td></tr>
            ) : rows.map((x) => (
              <tr key={x.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-900">{x.docNumber}</td>
                <td className="px-4 py-3 text-gray-600">{x.employeeName ?? "—"}</td>
                <td className="px-4 py-3 text-gray-600">{x.categoryName ?? "—"}</td>
                <td className="px-4 py-3 text-right text-gray-900">{money(x.amountMinor, x.currency)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[x.status] ?? ""}`}>{x.status}</span></td>
                <td className="px-4 py-3 text-right">
                  {x.status === "draft" && <button onClick={() => act(x.id, "submit")} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs rounded-md"><Send className="h-3.5 w-3.5" /> Submit</button>}
                  {x.status === "approved" && <button onClick={() => act(x.id, "reimburse")} className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-600/80 hover:bg-green-600 text-white text-xs rounded-md"><DollarSign className="h-3.5 w-3.5" /> Reimburse</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
