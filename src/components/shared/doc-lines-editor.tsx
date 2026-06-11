"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";

interface LineIn {
  description: string;
  quantity: number;
  unitPriceMinor?: number;
  unitCostMinor?: number;
  productId?: string | null;
  taxRateId?: string | null;
}

interface EditRow {
  description: string;
  quantity: string;
  price: string; // major units
  productId?: string | null;
  taxRateId?: string | null;
}

/**
 * Draft-document line editor (audit P7 — the PATCH APIs accepted `lines`
 * everywhere, but no screen exposed it). One component for estimates,
 * invoices, purchase orders and sales orders: swap the read-only table for
 * editable rows, send `{ lines }` (prices in MAJOR units, as the APIs
 * expect), parent reloads.
 */
export function DocLinesEditor({
  endpoint,
  lines,
  priceField,
  currency = "USD",
  onSaved,
}: {
  endpoint: string; // e.g. /api/estimates/abc123
  lines: LineIn[];
  priceField: "unitPrice" | "unitCost";
  currency?: string;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<EditRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const start = () => {
    setRows(
      lines.length > 0
        ? lines.map((l) => ({
            description: l.description,
            quantity: String(l.quantity),
            price: (((l.unitPriceMinor ?? l.unitCostMinor) ?? 0) / 100).toFixed(2),
            productId: l.productId ?? undefined,
            taxRateId: l.taxRateId ?? undefined,
          }))
        : [{ description: "", quantity: "1", price: "0.00" }]
    );
    setError("");
    setEditing(true);
  };

  const set = (i: number, patch: Partial<EditRow>) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const save = async () => {
    const clean = rows.filter((r) => r.description.trim());
    if (clean.length === 0) { setError("At least one line with a description is required"); return; }
    setSaving(true); setError("");
    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lines: clean.map((r) => ({
          description: r.description.trim(),
          quantity: Number(r.quantity) || 1,
          [priceField]: Number(r.price) || 0,
          ...(r.productId ? { productId: r.productId } : {}),
          ...(r.taxRateId ? { taxRateId: r.taxRateId } : {}),
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to save lines"); return; }
    setEditing(false);
    onSaved();
  };

  const subtotal = rows.reduce((s, r) => s + (Number(r.quantity) || 0) * (Number(r.price) || 0), 0);

  if (!editing) {
    return (
      <button onClick={start} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-gray-700 hover:text-gray-900 text-xs font-medium rounded-md">
        <Pencil className="h-3.5 w-3.5" /> Edit lines
      </button>
    );
  }

  return (
    <div className="bg-white border border-blue-200 rounded-lg overflow-hidden mb-4 shadow-sm">
      <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
        <span className="text-sm font-semibold text-blue-800">Editing lines</span>
        <button onClick={() => setEditing(false)} className="text-blue-400 hover:text-blue-700"><X className="h-4 w-4" /></button>
      </div>
      {error && <div className="px-4 py-2 text-xs text-red-600 bg-red-50">{error}</div>}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="px-4 py-2 font-medium">Description</th>
            <th className="px-2 py-2 font-medium w-24 text-right">Qty</th>
            <th className="px-2 py-2 font-medium w-32 text-right">{priceField === "unitCost" ? "Unit cost" : "Unit price"}</th>
            <th className="px-2 py-2 w-10" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-gray-100">
              <td className="px-4 py-1.5">
                <input value={r.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="Line description" className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-sm text-gray-900" />
              </td>
              <td className="px-2 py-1.5">
                <input type="number" min="0" step="any" value={r.quantity} onChange={(e) => set(i, { quantity: e.target.value })} className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-sm text-right text-gray-900" />
              </td>
              <td className="px-2 py-1.5">
                <input type="number" min="0" step="0.01" value={r.price} onChange={(e) => set(i, { price: e.target.value })} className="w-full bg-white border border-gray-200 rounded px-2 py-1.5 text-sm text-right text-gray-900" />
              </td>
              <td className="px-2 py-1.5 text-center">
                <button onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="px-4 py-2.5 flex items-center border-t border-gray-100">
        <button onClick={() => setRows((prev) => [...prev, { description: "", quantity: "1", price: "0.00" }])} className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900">
          <Plus className="h-3.5 w-3.5" /> Add line
        </button>
        <span className="ml-auto text-xs text-gray-500 mr-4">Subtotal ≈ {currency} {subtotal.toFixed(2)} (tax recomputed on save)</span>
        <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900">Cancel</button>
        <button onClick={save} disabled={saving} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-medium rounded-md ml-2">{saving ? "Saving…" : "Save lines"}</button>
      </div>
    </div>
  );
}
