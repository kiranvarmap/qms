"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Level { warehouseId: string; warehouseName: string | null; onHand: number; committed: number; available: number }
interface Product {
  id: string; name: string; sku: string | null; type: string; category: string | null; unit: string;
  costMinor: number; priceMinor: number; reorderLevel: number; trackInventory: boolean; levels: Level[];
}
interface Movement {
  id: string; type: string; quantity: number; onHandDelta: number; committedDelta: number;
  warehouseName: string | null; refType: string | null; note: string | null; createdAt: string;
}

function money(minor: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(minor / 100);
}

const typeColors: Record<string, string> = {
  receipt: "text-green-600",
  shipment: "text-red-600",
  reservation: "text-amber-600",
  reservation_release: "text-blue-600",
  adjustment: "text-purple-600",
  transfer: "text-indigo-600",
};

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, m] = await Promise.all([
      fetch(`/api/products/${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/products/${id}/movements`).then((r) => r.json()).catch(() => ({})),
    ]);
    setProduct(p);
    setMovements(Array.isArray(m.data) ? m.data : []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!product) return <div className="p-8 text-gray-500">Product not found.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard/inventory" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Inventory
      </Link>

      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">{product.name}</h1>
        <p className="text-sm text-gray-600 mt-1">
          {product.sku ? `${product.sku} · ` : ""}{product.category ?? "Uncategorized"} · {product.unit} · {money(product.priceMinor)}
        </p>
      </div>

      {product.trackInventory && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Stock by warehouse</h2>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-2.5 font-medium">Warehouse</th>
                  <th className="px-4 py-2.5 font-medium text-right">On hand</th>
                  <th className="px-4 py-2.5 font-medium text-right">Committed</th>
                  <th className="px-4 py-2.5 font-medium text-right">Available</th>
                </tr>
              </thead>
              <tbody>
                {product.levels.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500">No stock recorded.</td></tr>
                ) : product.levels.map((l) => (
                  <tr key={l.warehouseId} className="border-b border-gray-200">
                    <td className="px-4 py-2.5 text-gray-900">{l.warehouseName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right text-gray-700">{l.onHand}</td>
                    <td className="px-4 py-2.5 text-right text-gray-600">{l.committed}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900">{l.available}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold text-gray-700 mb-2">Movement ledger</h2>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-4 py-2.5 font-medium">Type</th>
              <th className="px-4 py-2.5 font-medium">Warehouse</th>
              <th className="px-4 py-2.5 font-medium text-right">On-hand Δ</th>
              <th className="px-4 py-2.5 font-medium text-right">Committed Δ</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500">No movements yet.</td></tr>
            ) : movements.map((m) => (
              <tr key={m.id} className="border-b border-gray-200">
                <td className="px-4 py-2.5 text-gray-600">{new Date(m.createdAt).toLocaleString()}</td>
                <td className={`px-4 py-2.5 font-medium ${typeColors[m.type] ?? "text-gray-700"}`}>{m.type.replace(/_/g, " ")}</td>
                <td className="px-4 py-2.5 text-gray-600">{m.warehouseName ?? "—"}</td>
                <td className="px-4 py-2.5 text-right text-gray-700">{m.onHandDelta > 0 ? `+${m.onHandDelta}` : m.onHandDelta}</td>
                <td className="px-4 py-2.5 text-right text-gray-600">{m.committedDelta > 0 ? `+${m.committedDelta}` : m.committedDelta || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
