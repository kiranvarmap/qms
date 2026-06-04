"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Wallet, Send, DollarSign, X, AlertCircle } from "lucide-react";

interface Workspace { id: string; name: string }
interface Category { id: string; name: string }
interface Vendor { id: string; name: string }
interface Expense {
  id: string; docNumber: string; status: string; amountMinor: number; currency: string;
  spentAt: string; description: string | null; employeeName: string | null; categoryName: string | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-600/40 text-gray-300",
  submitted: "bg-yellow-500/20 text-yellow-400",
  approved: "bg-blue-500/20 text-blue-400",
  rejected: "bg-red-500/20 text-red-400",
  reimbursed: "bg-green-500/20 text-green-400",
};

function money(minor: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
}

const emptyForm = { categoryId: "", vendorId: "", amount: "", spentAt: "", description: "" };

export default function ExpensesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [rows, setRows] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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
    const [e, c, v] = await Promise.all([
      fetch(`/api/expenses?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/expense-categories?workspaceId=${workspaceId}`).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/vendors?workspaceId=${workspaceId}&status=active`).then((r) => r.json()).catch(() => ({})),
    ]);
    setRows(Array.isArray(e.data) ? e.data : []);
    setCategories(Array.isArray(c.data) ? c.data : []);
    setVendors(Array.isArray(v.data) ? v.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const addCategory = async () => {
    if (!newCategory.trim()) return;
    const res = await fetch("/api/expense-categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name: newCategory.trim() }),
    });
    if (res.ok) { const c = await res.json(); setCategories((cs) => [...cs, c]); setForm((f) => ({ ...f, categoryId: c.id })); setNewCategory(""); }
  };

  const create = async () => {
    if (!form.amount || Number(form.amount) <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/expenses", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        categoryId: form.categoryId || undefined,
        vendorId: form.vendorId || undefined,
        amount: Number(form.amount),
        spentAt: form.spentAt ? new Date(form.spentAt).toISOString() : undefined,
        description: form.description.trim() || undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) { const er = await res.json().catch(() => ({})); setError(er.error || "Failed"); return; }
    setShowCreate(false); setForm(emptyForm); load();
  };

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
          <Wallet className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-semibold text-white">Expenses</h1>
        </div>
        <button onClick={() => { setForm(emptyForm); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Expense
        </button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-gray-900 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-gray-900 border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-white/10">
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
              <tr key={x.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-gray-200">{x.docNumber}</td>
                <td className="px-4 py-3 text-gray-400">{x.employeeName ?? "—"}</td>
                <td className="px-4 py-3 text-gray-400">{x.categoryName ?? "—"}</td>
                <td className="px-4 py-3 text-right text-gray-200">{money(x.amountMinor, x.currency)}</td>
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

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-gray-900 border border-white/10 rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">New Expense</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-300"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs text-gray-500">Category</span>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200">
                  <option value="">None</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <div className="flex gap-2">
                <input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="New category…" className="flex-1 bg-gray-950 border border-white/10 rounded-md px-3 py-1.5 text-sm text-gray-200" />
                <button onClick={addCategory} className="px-3 py-1.5 border border-white/10 text-gray-300 hover:text-white text-sm rounded-md">Add</button>
              </div>
              <label className="block">
                <span className="text-xs text-gray-500">Vendor (optional)</span>
                <select value={form.vendorId} onChange={(e) => setForm({ ...form, vendorId: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200">
                  <option value="">None</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block"><span className="text-xs text-gray-500">Amount</span><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200" /></label>
                <label className="block"><span className="text-xs text-gray-500">Date</span><input type="date" value={form.spentAt} onChange={(e) => setForm({ ...form, spentAt: e.target.value })} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200" /></label>
              </div>
              <label className="block"><span className="text-xs text-gray-500">Description</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200" /></label>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Cancel</button>
              <button onClick={create} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
