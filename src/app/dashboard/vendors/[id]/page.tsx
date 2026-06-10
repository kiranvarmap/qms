"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Plus, Trash2, Star, ShieldCheck, Send, BadgeCheck, MapPin, FileText, Landmark, BarChart3, Package, ShoppingCart } from "lucide-react";

interface Vendor { id: string; name: string; code: string | null; status: string; approvalState: string; isPreferred: boolean; }
interface Address { id: string; kind: string; line1: string | null; city: string | null; country: string | null; }
interface Doc { id: string; docType: string; number: string | null; expiryDate: string | null; status: string; isMandatory: boolean; }
interface Bank { id: string; bankName: string | null; accountNumber: string | null; isVerified: boolean; }
interface Perf { id: string; onTimePct: number; qualityRejectPct: number; rating: number; createdAt: string; }
interface Item { id: string; description: string | null; vendorSku: string | null; unitPriceMinor: number; leadTimeDays: number; }
interface PoRow { id: string; docNumber: string; status: string; totalMinor: number; expectedDate: string | null; createdAt: string }
interface Detail { vendor: Vendor; addresses: Address[]; documents: Doc[]; bankAccounts: Bank[]; performance: Perf[]; items: Item[]; purchaseOrders: PoRow[]; openPoMinor: number; lifetimeSpendMinor: number; }

const docBadge: Record<string, string> = { valid: "bg-green-100 text-green-700", expiring: "bg-amber-100 text-amber-700", expired: "bg-red-100 text-red-700" };
const apprBadge: Record<string, string> = { approved: "bg-green-100 text-green-700", pending: "bg-amber-100 text-amber-700", rejected: "bg-red-100 text-red-700" };

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/vendors/${id}/detail`);
    const data = await res.json();
    setD(res.ok && data.vendor ? data : null);
    setLoading(false);
  }, [id]);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const post = async (path: string, body: unknown) => { await fetch(`/api/vendors/${id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); load(); };
  const del = async (path: string, rid: string) => { await fetch(`/api/vendors/${id}/${path}?id=${rid}`, { method: "DELETE" }); load(); };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!d) return <div className="p-8 text-gray-500">Vendor not found. <Link href="/dashboard/vendors" className="text-blue-600 hover:underline">Back</Link></div>;
  const v = d.vendor;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Link href="/dashboard/vendors" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Vendors</Link>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-gray-900">
              <Building2 className="h-5 w-5 text-blue-600" />
              <h1 className="text-xl font-semibold">{v.name}</h1>
              {v.code && <span className="text-gray-400 font-mono text-xs">{v.code}</span>}
              {v.isPreferred && <span className="inline-flex items-center gap-1 text-xs text-amber-600"><Star className="h-3.5 w-3.5 fill-amber-400" /> Preferred</span>}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-medium ${apprBadge[v.approvalState] || "bg-gray-100 text-gray-700"}`}>{v.approvalState}</span>
              <span className="rounded-full px-2 py-0.5 font-medium bg-gray-100 text-gray-700">{v.status}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => post("preferred", { isPreferred: !v.isPreferred })} className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm rounded-md"><Star className="h-4 w-4" /> {v.isPreferred ? "Unprefer" : "Prefer"}</button>
            {v.approvalState !== "pending" && (
              <button onClick={() => post("submit", {})} className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md"><Send className="h-4 w-4" /> Submit for approval</button>
            )}
          </div>
        </div>
      </div>

      {/* Spend summary + purchasing history (vendor 360°) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm"><div className="text-xs text-gray-500">Open POs</div><div className="text-lg font-semibold mt-0.5 text-blue-700">{(d.openPoMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm"><div className="text-xs text-gray-500">Lifetime spend</div><div className="text-lg font-semibold mt-0.5 text-gray-900">{(d.lifetimeSpendMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></div>
      </div>

      <Card icon={<ShoppingCart className="h-4 w-4 text-blue-600" />} title={`Purchase Orders (${d.purchaseOrders.length})`}>
        {d.purchaseOrders.length === 0 ? <p className="text-sm text-gray-500">No purchase orders yet.</p> : (
          <div className="space-y-2">
            {d.purchaseOrders.map((po) => (
              <div key={po.id} className="flex items-center justify-between text-sm">
                <Link href={`/dashboard/purchase-orders/${po.id}`} className="text-blue-700 hover:underline">{po.docNumber}</Link>
                <span className="text-gray-500 capitalize">{po.status.replace(/_/g, " ")}</span>
                <span className="text-gray-400 text-xs">{new Date(po.createdAt).toLocaleDateString()}</span>
                <span className="text-gray-900">{(po.totalMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Addresses data={d.addresses} onAdd={(b) => post("addresses", b)} onDel={(rid) => del("addresses", rid)} />
      <Documents data={d.documents} onAdd={(b) => post("documents", b)} onDel={(rid) => del("documents", rid)} />
      <BankAccounts data={d.bankAccounts} onAdd={(b) => post("bank-accounts", b)} onVerify={async (rid) => { await fetch(`/api/vendors/${id}/bank-accounts?id=${rid}`, { method: "PATCH" }); load(); }} onDel={(rid) => del("bank-accounts", rid)} />
      <Catalog data={d.items} onAdd={(b) => post("items", b)} onDel={(rid) => del("items", rid)} />
      <Performance data={d.performance} onAdd={(b) => post("performance", b)} />
    </div>
  );
}

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 text-gray-900 font-medium">{icon}{title}</div>
      <div className="p-6">{children}</div>
    </div>
  );
}
const inp = "bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900";

function Addresses({ data, onAdd, onDel }: { data: { id: string; kind: string; line1: string | null; city: string | null; country: string | null }[]; onAdd: (b: unknown) => void; onDel: (id: string) => void }) {
  const [f, setF] = useState({ kind: "billing", line1: "", city: "", country: "" });
  return (
    <Card icon={<MapPin className="h-4 w-4 text-blue-600" />} title="Addresses">
      <div className="space-y-2 mb-4">{data.map((a) => (<div key={a.id} className="flex items-center justify-between text-sm"><span className="text-gray-900"><span className="text-gray-500 capitalize">{a.kind}:</span> {[a.line1, a.city, a.country].filter(Boolean).join(", ") || "—"}</span><button onClick={() => onDel(a.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>))}{data.length === 0 && <p className="text-sm text-gray-500">No addresses.</p>}</div>
      <div className="flex flex-wrap gap-2">
        <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={inp}><option value="billing">Billing</option><option value="shipping">Shipping</option><option value="remit">Remit-to</option></select>
        <input value={f.line1} onChange={(e) => setF({ ...f, line1: e.target.value })} placeholder="Line 1" className={`${inp} flex-1`} />
        <input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} placeholder="City" className={`${inp} w-32`} />
        <input value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })} placeholder="CC" className={`${inp} w-16`} />
        <button onClick={() => { onAdd({ kind: f.kind, line1: f.line1 || undefined, city: f.city || undefined, country: f.country || undefined }); setF({ kind: "billing", line1: "", city: "", country: "" }); }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /></button>
      </div>
    </Card>
  );
}

function Documents({ data, onAdd, onDel }: { data: { id: string; docType: string; number: string | null; expiryDate: string | null; status: string; isMandatory: boolean }[]; onAdd: (b: unknown) => void; onDel: (id: string) => void }) {
  const [f, setF] = useState({ docType: "", number: "", expiryDate: "", isMandatory: false });
  return (
    <Card icon={<FileText className="h-4 w-4 text-blue-600" />} title="Compliance Documents">
      <div className="space-y-2 mb-4">{data.map((doc) => (<div key={doc.id} className="flex items-center justify-between text-sm"><span className="text-gray-900">{doc.docType}{doc.number ? ` · ${doc.number}` : ""}{doc.expiryDate ? ` · exp ${new Date(doc.expiryDate).toLocaleDateString()}` : ""}{doc.isMandatory ? " · mandatory" : ""}</span><span className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${docBadge[doc.status]}`}>{doc.status}</span><button onClick={() => onDel(doc.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></span></div>))}{data.length === 0 && <p className="text-sm text-gray-500">No documents.</p>}</div>
      <div className="flex flex-wrap gap-2">
        <input value={f.docType} onChange={(e) => setF({ ...f, docType: e.target.value })} placeholder="Doc type (W-9, GST cert…)" className={`${inp} flex-1`} />
        <input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} placeholder="Number" className={`${inp} w-32`} />
        <input type="date" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} className={inp} />
        <label className="flex items-center gap-1 text-sm text-gray-600"><input type="checkbox" checked={f.isMandatory} onChange={(e) => setF({ ...f, isMandatory: e.target.checked })} /> mand.</label>
        <button onClick={() => { if (!f.docType.trim()) return; onAdd({ docType: f.docType.trim(), number: f.number || undefined, expiryDate: f.expiryDate ? new Date(f.expiryDate).toISOString() : undefined, isMandatory: f.isMandatory }); setF({ docType: "", number: "", expiryDate: "", isMandatory: false }); }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /></button>
      </div>
    </Card>
  );
}

function BankAccounts({ data, onAdd, onVerify, onDel }: { data: { id: string; bankName: string | null; accountNumber: string | null; isVerified: boolean }[]; onAdd: (b: unknown) => void; onVerify: (id: string) => void; onDel: (id: string) => void }) {
  const [f, setF] = useState({ bankName: "", accountNumber: "", routing: "" });
  return (
    <Card icon={<Landmark className="h-4 w-4 text-blue-600" />} title="Bank Accounts">
      <div className="space-y-2 mb-4">{data.map((b) => (<div key={b.id} className="flex items-center justify-between text-sm"><span className="text-gray-900">{b.bankName || "—"} · {b.accountNumber || "—"}</span><span className="flex items-center gap-2">{b.isVerified ? <span className="inline-flex items-center gap-1 text-xs text-green-700"><BadgeCheck className="h-4 w-4" /> verified</span> : <button onClick={() => onVerify(b.id)} className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> verify</button>}<button onClick={() => onDel(b.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></span></div>))}{data.length === 0 && <p className="text-sm text-gray-500">No bank accounts.</p>}</div>
      <div className="flex flex-wrap gap-2">
        <input value={f.bankName} onChange={(e) => setF({ ...f, bankName: e.target.value })} placeholder="Bank" className={`${inp} flex-1`} />
        <input value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} placeholder="Account #" className={`${inp} w-40`} />
        <input value={f.routing} onChange={(e) => setF({ ...f, routing: e.target.value })} placeholder="Routing/SWIFT" className={`${inp} w-32`} />
        <button onClick={() => { onAdd({ bankName: f.bankName || undefined, accountNumber: f.accountNumber || undefined, routing: f.routing || undefined }); setF({ bankName: "", accountNumber: "", routing: "" }); }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /></button>
      </div>
    </Card>
  );
}

function Catalog({ data, onAdd, onDel }: { data: { id: string; description: string | null; vendorSku: string | null; unitPriceMinor: number; leadTimeDays: number }[]; onAdd: (b: unknown) => void; onDel: (id: string) => void }) {
  const [f, setF] = useState({ description: "", vendorSku: "", unitPrice: "", leadTimeDays: "" });
  return (
    <Card icon={<Package className="h-4 w-4 text-blue-600" />} title="Item Catalog">
      <div className="space-y-2 mb-4">{data.map((it) => (<div key={it.id} className="flex items-center justify-between text-sm"><span className="text-gray-900">{it.description || "—"} {it.vendorSku ? <span className="text-gray-400 font-mono text-xs">· {it.vendorSku}</span> : null} · {(it.unitPriceMinor / 100).toFixed(2)} · {it.leadTimeDays}d</span><button onClick={() => onDel(it.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button></div>))}{data.length === 0 && <p className="text-sm text-gray-500">No catalog items.</p>}</div>
      <div className="flex flex-wrap gap-2">
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Item" className={`${inp} flex-1`} />
        <input value={f.vendorSku} onChange={(e) => setF({ ...f, vendorSku: e.target.value })} placeholder="Vendor SKU" className={`${inp} w-32`} />
        <input type="number" value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} placeholder="Price" className={`${inp} w-24`} />
        <input type="number" value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: e.target.value })} placeholder="Lead d" className={`${inp} w-20`} />
        <button onClick={() => { onAdd({ description: f.description || undefined, vendorSku: f.vendorSku || undefined, unitPrice: Number(f.unitPrice) || 0, leadTimeDays: Number(f.leadTimeDays) || 0 }); setF({ description: "", vendorSku: "", unitPrice: "", leadTimeDays: "" }); }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /></button>
      </div>
    </Card>
  );
}

function Performance({ data, onAdd }: { data: { id: string; onTimePct: number; qualityRejectPct: number; rating: number; createdAt: string }[]; onAdd: (b: unknown) => void }) {
  const [f, setF] = useState({ onTimePct: "", qualityRejectPct: "", rating: "" });
  return (
    <Card icon={<BarChart3 className="h-4 w-4 text-blue-600" />} title="Performance Scorecard">
      <div className="space-y-2 mb-4">{data.map((p) => (<div key={p.id} className="flex items-center justify-between text-sm text-gray-900"><span>{new Date(p.createdAt).toLocaleDateString()}</span><span className="text-gray-600">On-time {p.onTimePct}% · Reject {p.qualityRejectPct}% · ★ {p.rating}</span></div>))}{data.length === 0 && <p className="text-sm text-gray-500">No scorecards.</p>}</div>
      <div className="flex flex-wrap gap-2">
        <input type="number" value={f.onTimePct} onChange={(e) => setF({ ...f, onTimePct: e.target.value })} placeholder="On-time %" className={`${inp} w-28`} />
        <input type="number" value={f.qualityRejectPct} onChange={(e) => setF({ ...f, qualityRejectPct: e.target.value })} placeholder="Reject %" className={`${inp} w-28`} />
        <input type="number" value={f.rating} onChange={(e) => setF({ ...f, rating: e.target.value })} placeholder="Rating 0-5" className={`${inp} w-28`} />
        <button onClick={() => { onAdd({ onTimePct: Number(f.onTimePct) || 0, qualityRejectPct: Number(f.qualityRejectPct) || 0, rating: Number(f.rating) || 0 }); setF({ onTimePct: "", qualityRejectPct: "", rating: "" }); }} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /></button>
      </div>
    </Card>
  );
}
