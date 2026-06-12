"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import { LearnMore as BookOpen, Add as Plus } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Account { id: string; code: string; name: string; type: string; }

const typeBadge: Record<string, string> = { asset: "bg-blue-100 text-blue-700", liability: "bg-amber-100 text-amber-700", equity: "bg-violet-100 text-violet-700", income: "bg-green-100 text-green-700", expense: "bg-red-100 text-red-700" };

export default function AccountsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", name: "", type: "asset" });

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await fetch(`/api/accounts?workspaceId=${workspaceId}`);
    const data = await res.json();
    setAccounts(res.ok ? (data.data ?? []) : []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const create = async () => {
    if (!form.code.trim() || !form.name.trim()) return;
    await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, code: form.code.trim(), name: form.name.trim(), type: form.type }) });
    setForm({ code: "", name: "", type: "asset" }); load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6"><BookOpen className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Chart of Accounts</h1></div>
      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm mb-4">
        <div className="flex gap-2">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Code (e.g. 1000)" className="w-32 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Account name" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
          <NativeSelect value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option><option value="income">Income</option><option value="expense">Expense</option></NativeSelect>
          <button onClick={create} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Code</th><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Type</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : accounts.length === 0 ? <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">No accounts yet.</td></tr>
            : accounts.map((a) => (
              <tr key={a.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{a.code}</td>
                <td className="px-4 py-3 text-gray-900">{a.name}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${typeBadge[a.type]}`}>{a.type}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
