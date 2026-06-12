"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Note as BookText, Add as Plus, CloseSmall as X, Doc as ScrollText } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Account { id: string; code: string; name: string }
interface JE { id: string; docNumber: string; memo: string | null; status: string; entryDate: string; }

export default function JournalPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JE[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [memo, setMemo] = useState("");
  const [post, setPost] = useState(true);
  const [lines, setLines] = useState([{ accountId: "", debit: "", credit: "" }, { accountId: "", debit: "", credit: "" }]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [je, ac] = await Promise.all([
      fetch(`/api/journal-entries?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/accounts?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setEntries(je.data ?? []); setAccounts(ac.data ?? []);
    setLoading(false);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const totalDr = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  const create = async () => {
    setSaving(true); setErr("");
    const payloadLines = lines.filter((l) => l.accountId).map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
    const res = await fetch("/api/journal-entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, memo: memo.trim() || undefined, post, lines: payloadLines }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setErr(e.error || "Failed"); return; }
    setShow(false); setMemo(""); setLines([{ accountId: "", debit: "", credit: "" }, { accountId: "", debit: "", credit: "" }]); load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><BookText className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Journal Entries</h1></div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/books/trial-balance" className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-md"><ScrollText className="h-4 w-4" /> Trial Balance</Link>
          <button onClick={() => setShow(true)} disabled={!workspaceId} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> New Entry</button>
        </div>
      </div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50"><th className="px-4 py-3 font-medium">Number</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Memo</th><th className="px-4 py-3 font-medium">Status</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : entries.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No journal entries.</td></tr>
            : entries.map((e) => (
              <tr key={e.id} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.docNumber}</td>
                <td className="px-4 py-3 text-gray-600">{new Date(e.entryDate).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-gray-900">{e.memo || "—"}</td>
                <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${e.status === "posted" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShow(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-2xl p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">New Journal Entry</h2><button onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            {err && <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{err}</div>}
            <input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Memo" className="w-full mb-3 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
            <div className="space-y-2 mb-2">
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2">
                  <NativeSelect value={l.accountId} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, accountId: e.target.value } : x))} className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">Account…</option>{accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}</NativeSelect>
                  <input type="number" value={l.debit} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, debit: e.target.value } : x))} placeholder="Debit" className="w-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                  <input type="number" value={l.credit} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, credit: e.target.value } : x))} placeholder="Credit" className="w-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm mb-3">
              <button onClick={() => setLines([...lines, { accountId: "", debit: "", credit: "" }])} className="text-gray-600 hover:text-gray-900">+ line</button>
              <span className={totalDr === totalCr ? "text-green-700" : "text-red-600"}>Dr {totalDr.toFixed(2)} / Cr {totalCr.toFixed(2)} {totalDr === totalCr ? "✓ balanced" : "✗ unbalanced"}</span>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 mb-4"><input type="checkbox" checked={post} onChange={(e) => setPost(e.target.checked)} /> Post immediately</label>
            <div className="flex justify-end gap-2"><button onClick={() => setShow(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button><button onClick={create} disabled={saving || totalDr !== totalCr} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
