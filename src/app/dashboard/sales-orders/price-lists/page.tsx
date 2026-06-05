"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Tags, Plus } from "lucide-react";

interface Workspace { id: string; name: string }
interface Product { id: string; name: string }
interface PL { id: string; name: string; currency: string; isDefault: boolean; }
interface PLItem { id: string; productId: string; unitPriceMinor: number; }

export default function PriceListsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [lists, setLists] = useState<PL[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [items, setItems] = useState<PLItem[]>([]);
  const [newName, setNewName] = useState("");
  const [itemForm, setItemForm] = useState({ productId: "", unitPrice: "" });

  const pName = (id: string) => products.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    const [pl, pr] = await Promise.all([
      fetch(`/api/price-lists?workspaceId=${workspaceId}`).then((r) => r.json()),
      fetch(`/api/products?workspaceId=${workspaceId}`).then((r) => r.json()),
    ]);
    setLists(pl.data ?? []); setProducts(pr.data ?? []);
  }, [workspaceId]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const loadItems = useCallback(async () => {
    if (!selected) { setItems([]); return; }
    const res = await fetch(`/api/price-lists/${selected}`);
    const data = await res.json();
    setItems(res.ok ? (data.items ?? []) : []);
  }, [selected]);
  useEffect(() => { loadItems(); }, [loadItems]); // eslint-disable-line react-hooks/set-state-in-effect

  const createList = async () => { if (!newName.trim()) return; await fetch("/api/price-lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, name: newName.trim() }) }); setNewName(""); load(); };
  const addItem = async () => { if (!selected || !itemForm.productId) return; await fetch(`/api/price-lists/${selected}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: itemForm.productId, unitPrice: Number(itemForm.unitPrice) || 0 }) }); setItemForm({ productId: "", unitPrice: "" }); loadItems(); };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link href="/dashboard/sales-orders" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Sales Orders</Link>
      <div className="flex items-center gap-3 mb-6"><Tags className="h-6 w-6 text-blue-600" /><h1 className="text-xl font-semibold text-gray-900">Price Lists</h1></div>
      <select value={workspaceId} onChange={(e) => { setWorkspaceId(e.target.value); setSelected(""); }} className="mb-4 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="font-medium text-gray-900 mb-3">Lists</div>
          <div className="space-y-1 mb-3">
            {lists.length === 0 ? <p className="text-sm text-gray-500">No price lists.</p> : lists.map((l) => (
              <button key={l.id} onClick={() => setSelected(l.id)} className={`block w-full text-left px-3 py-2 rounded-md text-sm ${selected === l.id ? "bg-blue-50 text-blue-700" : "hover:bg-gray-50 text-gray-900"}`}>{l.name} <span className="text-gray-400 text-xs">{l.currency}{l.isDefault ? " · default" : ""}</span></button>
            ))}
          </div>
          <div className="flex gap-2"><input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New list name" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /><button onClick={createList} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /></button></div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="font-medium text-gray-900 mb-3">Prices {selected ? "" : "(select a list)"}</div>
          {selected && (
            <>
              <div className="space-y-1 mb-3">
                {items.length === 0 ? <p className="text-sm text-gray-500">No prices set.</p> : items.map((it) => (
                  <div key={it.id} className="flex justify-between text-sm text-gray-900"><span>{pName(it.productId)}</span><span>{(it.unitPriceMinor / 100).toFixed(2)}</span></div>
                ))}
              </div>
              <div className="flex gap-2">
                <select value={itemForm.productId} onChange={(e) => setItemForm({ ...itemForm, productId: e.target.value })} className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"><option value="">Product…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input type="number" value={itemForm.unitPrice} onChange={(e) => setItemForm({ ...itemForm, unitPrice: e.target.value })} placeholder="Price" className="w-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
                <button onClick={addItem} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /></button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
