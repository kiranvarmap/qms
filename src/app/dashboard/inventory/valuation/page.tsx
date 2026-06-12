"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, CreditCard as DollarSign } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Row { productId: string; name: string; sku: string | null; method: string; onHand: number; valueMinor: number; }

export default function ValuationPage() {
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
    const res = await fetch(`/api/inventory/valuation?workspaceId=${workspaceId}`);
    const data = await res.json();
    setRows(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const total = rows.reduce((s, r) => s + r.valueMinor, 0);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Inventory</Link>
      <div className="flex items-center gap-3 mb-6"><DollarSign className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Inventory Valuation</h1></div>

      <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </NativeSelect>

      <div className="mb-4 bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
        <div className="text-sm text-gray-500">Total inventory value</div>
        <div className="text-[24px] font-semibold tracking-tight text-gray-900 [font-family:var(--font-display)]">{(total / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium text-right">On hand</th><th className="px-4 py-3 font-medium text-right">Value</th>
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            : rows.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No products.</td></tr>
            : rows.map((r) => (
              <tr key={r.productId} className="border-b border-gray-100">
                <td className="px-4 py-3 text-gray-900">{r.name}{r.sku ? <span className="text-gray-400 font-mono text-xs"> · {r.sku}</span> : null}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{r.method}</td>
                <td className="px-4 py-3 text-right text-gray-600">{r.onHand}</td>
                <td className="px-4 py-3 text-right text-gray-900">{(r.valueMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
