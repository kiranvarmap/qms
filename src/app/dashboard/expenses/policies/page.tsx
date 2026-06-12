"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Security as ShieldCheck, Check } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Category { id: string; name: string; maxAmountMinor: number; receiptRequiredAboveMinor: number; }

export default function ExpensePoliciesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [edited, setEdited] = useState<Record<string, { max: string; receipt: string }>>({});
  const [savedId, setSavedId] = useState("");
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
    const res = await fetch(`/api/expense-categories?workspaceId=${workspaceId}`);
    const data = await res.json();
    setCategories(res.ok ? (data.data ?? data ?? []) : []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const val = (c: Category, f: "max" | "receipt") => {
    const e = edited[c.id];
    if (e) return f === "max" ? e.max : e.receipt;
    return ((f === "max" ? c.maxAmountMinor : c.receiptRequiredAboveMinor) / 100).toString();
  };
  const save = async (c: Category) => {
    const e = edited[c.id] ?? { max: (c.maxAmountMinor / 100).toString(), receipt: (c.receiptRequiredAboveMinor / 100).toString() };
    await fetch(`/api/expense-categories/${c.id}/policy`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ maxAmount: Number(e.max) || 0, receiptRequiredAbove: Number(e.receipt) || 0 }) });
    setSavedId(c.id); setTimeout(() => setSavedId(""), 1500); load();
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/dashboard/expenses" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Expenses</Link>
      <div className="flex items-center gap-3 mb-2"><ShieldCheck className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Expense Policies</h1></div>
      <p className="text-sm text-gray-500 mb-6">Per-category spend limit and receipt-required threshold. Violations are flagged when an expense is submitted. (0 = no rule.)</p>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Max amount</th><th className="px-4 py-3 font-medium">Receipt above</th><th className="px-4 py-3 font-medium text-right"></th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : categories.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No categories.</td></tr>
            : categories.map((c) => (
              <tr key={c.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900">{c.name}</td>
                <td className="px-4 py-3"><input type="number" value={val(c, "max")} onChange={(e) => setEdited({ ...edited, [c.id]: { max: e.target.value, receipt: val(c, "receipt") } })} className="w-28 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900" /></td>
                <td className="px-4 py-3"><input type="number" value={val(c, "receipt")} onChange={(e) => setEdited({ ...edited, [c.id]: { max: val(c, "max"), receipt: e.target.value } })} className="w-28 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900" /></td>
                <td className="px-4 py-3 text-right"><button onClick={() => save(c)} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1">{savedId === c.id ? <><Check className="h-3.5 w-3.5 text-green-600" /> Saved</> : "Save"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
