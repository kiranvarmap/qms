"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, CheckCircle2 } from "lucide-react";

interface CC { id: string; status: string; note: string | null; }
interface Line { id: string; productId: string; systemQty: number; countedQty: number | null; }
interface Product { id: string; name: string; sku: string | null }

export default function CycleCountDetail() {
  const { id } = useParams<{ id: string }>();
  const [cc, setCc] = useState<CC | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const productName = (pid: string) => products.find((p) => p.id === pid)?.name ?? pid.slice(0, 8);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inventory/cycle-counts/${id}`);
    const data = await res.json();
    if (res.ok && data.count) {
      setCc(data.count); setLines(data.lines ?? []);
      // fetch product names (best effort) via any line's workspace through products list is not available here; skip — show ids
    } else setCc(null);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const saveCounts = async () => {
    setBusy(true);
    const counts = Object.entries(edited).map(([lineId, v]) => ({ lineId, countedQty: Number(v) || 0 }));
    await fetch(`/api/inventory/cycle-counts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ counts }) });
    setBusy(false); setEdited({}); load();
  };
  const post = async () => { setBusy(true); await fetch(`/api/inventory/cycle-counts/${id}/post`, { method: "POST" }); setBusy(false); load(); };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!cc) return <div className="p-8 text-gray-500">Not found. <Link href="/dashboard/inventory/cycle-counts" className="text-blue-600 hover:underline">Back</Link></div>;

  const posted = cc.status === "posted";

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/inventory/cycle-counts" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Cycle Counts</Link>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Cycle Count {cc.note ? `— ${cc.note}` : ""}</h1>
        {!posted && (
          <div className="flex gap-2">
            <button onClick={saveCounts} disabled={busy || Object.keys(edited).length === 0} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm rounded-md"><Save className="h-4 w-4" /> Save counts</button>
            <button onClick={post} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm rounded-md"><CheckCircle2 className="h-4 w-4" /> Post variances</button>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 font-medium">Product</th><th className="px-4 py-3 font-medium text-right">System</th><th className="px-4 py-3 font-medium text-right">Counted</th><th className="px-4 py-3 font-medium text-right">Variance</th>
          </tr></thead>
          <tbody>
            {lines.length === 0 ? <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No lines.</td></tr>
            : lines.map((l) => {
              const counted = edited[l.id] !== undefined ? edited[l.id] : (l.countedQty ?? "");
              const variance = counted === "" ? null : Number(counted) - l.systemQty;
              return (
                <tr key={l.id} className="border-b border-gray-100">
                  <td className="px-4 py-3 text-gray-900">{productName(l.productId)}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{l.systemQty}</td>
                  <td className="px-4 py-3 text-right">
                    {posted ? <span className="text-gray-600">{l.countedQty ?? "—"}</span>
                    : <input type="number" value={counted} onChange={(e) => setEdited({ ...edited, [l.id]: e.target.value })} className="w-24 bg-white border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-900 text-right" />}
                  </td>
                  <td className={`px-4 py-3 text-right ${variance == null ? "text-gray-400" : variance === 0 ? "text-gray-500" : variance > 0 ? "text-green-700" : "text-red-600"}`}>{variance == null ? "—" : variance > 0 ? `+${variance}` : variance}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
