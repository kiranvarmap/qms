"use client";

import { NativeSelect, DateInput } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Add as Plus, Delete as Trash2, Alert as AlertCircle } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Customer { id: string; name: string }
interface Product { id: string; name: string; priceMinor: number }
interface TaxRate { id: string; name: string; rateBasisPoints: number }
interface Employee { id: string; name?: string; firstName?: string; fullName?: string }
interface Project { id: string; name: string }
interface Line { productId: string; description: string; quantity: string; rate: string; taxRateId: string }

const inp = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:border-blue-500";
const emptyLine: Line = { productId: "", description: "", quantity: "1", rate: "0", taxRateId: "" };

export default function NewInvoicePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [h, setH] = useState({
    customerId: "", reference: "", issueDate: new Date().toISOString().slice(0, 10), dueDate: "",
    salespersonEmployeeId: "", projectId: "", subject: "",
    discountValue: "0", discountType: "percent", withholdingType: "", withholdingTaxRateId: "",
    adjustment: "0", customerNotes: "", termsConditions: "",
  });
  const setF = (k: keyof typeof h, v: string) => setH((p) => ({ ...p, [k]: v }));
  const [lines, setLines] = useState<Line[]>([{ ...emptyLine }]);
  const empName = (e: Employee) => e.name || e.fullName || e.firstName || "—";

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search).get("workspaceId") ?? "";
    if (qs) setWorkspaceId(qs); // eslint-disable-line react-hooks/set-state-in-effect
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (!qs && Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    const g = (u: string) => fetch(u).then((r) => r.json()).then((d) => d.data ?? d ?? []).catch(() => []);
    Promise.all([
      g(`/api/customers?workspaceId=${workspaceId}`), g(`/api/products?workspaceId=${workspaceId}`),
      g(`/api/tax-rates?workspaceId=${workspaceId}`), g(`/api/employees?workspaceId=${workspaceId}`),
      g(`/api/emp-projects?workspaceId=${workspaceId}`),
    ]).then(([cu, pr, tx, em, pj]) => { setCustomers(cu); setProducts(pr); setTaxRates(tx); setEmployees(em); setProjects(pj); });
  }, [workspaceId]);

  const taxBp = (id: string) => taxRates.find((t) => t.id === id)?.rateBasisPoints ?? 0;
  const totals = useMemo(() => {
    const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);
    const tax = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0) * (taxBp(l.taxRateId) / 10000), 0);
    const discount = h.discountType === "amount" ? Number(h.discountValue) || 0 : subtotal * (Number(h.discountValue) || 0) / 100;
    const base = subtotal - discount;
    const wh = h.withholdingType ? base * (taxBp(h.withholdingTaxRateId) / 10000) : 0;
    const adj = Number(h.adjustment) || 0;
    const total = base + tax + (h.withholdingType === "tcs" ? wh : h.withholdingType === "tds" ? -wh : 0) + adj;
    return { subtotal, tax, discount, wh, total };
  }, [lines, h, taxRates]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (sendAfter: boolean) => {
    if (!h.customerId) { setError("Customer is required"); return; }
    const payloadLines = lines.filter((l) => l.description.trim() || l.productId).map((l) => ({
      productId: l.productId || undefined,
      description: l.description.trim() || products.find((p) => p.id === l.productId)?.name || "Item",
      quantity: Number(l.quantity) || 1, unitPrice: Number(l.rate) || 0, taxRateId: l.taxRateId || undefined,
    }));
    if (payloadLines.length === 0) { setError("Add at least one line item"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      workspaceId, customerId: h.customerId,
      issueDate: h.issueDate ? new Date(h.issueDate).toISOString() : undefined,
      dueDate: h.dueDate ? new Date(h.dueDate).toISOString() : undefined,
      reference: h.reference || undefined, subject: h.subject || undefined,
      salespersonEmployeeId: h.salespersonEmployeeId || undefined, projectId: h.projectId || undefined,
      discountType: h.discountType, discountValue: Number(h.discountValue) || 0,
      withholdingType: h.withholdingType || null, withholdingTaxRateId: h.withholdingTaxRateId || null,
      adjustment: Number(h.adjustment) || 0,
      customerNotes: h.customerNotes || undefined, termsConditions: h.termsConditions || undefined,
      lines: payloadLines,
    }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to save"); return; }
    const inv = await res.json();
    if (sendAfter && inv?.id) await fetch(`/api/invoices/${inv.id}/send`, { method: "POST" }).catch(() => {});
    router.push("/dashboard/invoices");
  };

  const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-8 max-w-6xl mx-auto pb-28">
      <Link href="/dashboard/invoices" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3"><ArrowLeft className="h-4 w-4" /> Invoices</Link>
      <h1 className="text-[24px] font-semibold tracking-tight text-gray-900 [font-family:var(--font-display)] mb-6">New Invoice</h1>
      {error && <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      {workspaces.length > 1 && (
        <div className="mb-5"><label className="text-xs text-gray-500">Workspace</label>
          <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className={`${inp} max-w-xs mt-1`}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</NativeSelect>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-10 gap-y-4 max-w-4xl">
        <Row label="Customer Name" required>
          <NativeSelect value={h.customerId} onChange={(e) => setF("customerId", e.target.value)} className={inp}><option value="">Select or add a customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
        </Row>
        <div />
        <Row label="Reference#"><input value={h.reference} onChange={(e) => setF("reference", e.target.value)} className={inp} /></Row>
        <div />
        <Row label="Invoice Date" required><DateInput value={h.issueDate} onChange={(e) => setF("issueDate", e.target.value)} /></Row>
        <Row label="Due Date"><DateInput value={h.dueDate} onChange={(e) => setF("dueDate", e.target.value)} /></Row>
        <Row label="Salesperson"><NativeSelect value={h.salespersonEmployeeId} onChange={(e) => setF("salespersonEmployeeId", e.target.value)} className={inp}><option value="">Select or Add Salesperson</option>{employees.map((e) => <option key={e.id} value={e.id}>{empName(e)}</option>)}</NativeSelect></Row>
        <Row label="Project Name"><NativeSelect value={h.projectId} onChange={(e) => setF("projectId", e.target.value)} className={inp}><option value="">Select a project</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect></Row>
        <Row label="Subject"><input value={h.subject} onChange={(e) => setF("subject", e.target.value)} placeholder="Let your customer know what this invoice is for" className={inp} /></Row>
      </div>

      <div className="mt-8 bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 font-medium text-gray-900">Item Table</div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="px-4 py-2 font-medium">Item Details</th><th className="px-4 py-2 font-medium text-right w-28">Quantity</th><th className="px-4 py-2 font-medium text-right w-32">Rate</th><th className="px-4 py-2 font-medium w-40">Tax</th><th className="px-4 py-2 font-medium text-right w-28">Amount</th><th className="w-8"></th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const amt = (Number(l.quantity) || 0) * (Number(l.rate) || 0);
              return (
                <tr key={i} className="border-b border-gray-100 align-top">
                  <td className="px-2 py-2">
                    <NativeSelect value={l.productId} onChange={(e) => { const p = products.find((x) => x.id === e.target.value); setLines(lines.map((x, j) => j === i ? { ...x, productId: e.target.value, description: p?.name ?? x.description, rate: p ? String(p.priceMinor / 100) : x.rate } : x)); }} className={`${inp} mb-1`}><option value="">Type or click to select an item</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</NativeSelect>
                    <input value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Description" className={inp} />
                  </td>
                  <td className="px-2 py-2"><input type="number" value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} className={`${inp} text-right`} /></td>
                  <td className="px-2 py-2"><input type="number" value={l.rate} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, rate: e.target.value } : x))} className={`${inp} text-right`} /></td>
                  <td className="px-2 py-2"><NativeSelect value={l.taxRateId} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, taxRateId: e.target.value } : x))} className={inp}><option value="">Select a Tax</option>{taxRates.map((t) => <option key={t.id} value={t.id}>{t.name} ({(t.rateBasisPoints / 100).toFixed(0)}%)</option>)}</NativeSelect></td>
                  <td className="px-4 py-2 text-right text-gray-900">{money(amt)}</td>
                  <td className="px-1 py-2">{lines.length > 1 && <button onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-4 py-3"><button onClick={() => setLines([...lines, { ...emptyLine }])} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"><Plus className="h-4 w-4" /> Add New Row</button></div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-10">
        <div className="space-y-5">
          <div><label className="text-sm text-gray-700">Customer Notes</label><textarea value={h.customerNotes} onChange={(e) => setF("customerNotes", e.target.value)} rows={3} placeholder="Will be displayed on the invoice" className={`${inp} mt-1`} /></div>
          <div><label className="text-sm text-gray-700">Terms &amp; Conditions</label><textarea value={h.termsConditions} onChange={(e) => setF("termsConditions", e.target.value)} rows={4} className={`${inp} mt-1`} /></div>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 space-y-3 text-sm h-fit">
          <div className="flex justify-between text-gray-900"><span>Sub Total</span><span>{money(totals.subtotal)}</span></div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-700">Discount</span>
            <div className="flex items-center gap-1">
              <input type="number" value={h.discountValue} onChange={(e) => setF("discountValue", e.target.value)} className="w-20 bg-white border border-gray-300 rounded-md px-2 py-1 text-right text-sm" />
              <NativeSelect value={h.discountType} onChange={(e) => setF("discountType", e.target.value)} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-sm"><option value="percent">%</option><option value="amount">amt</option></NativeSelect>
              <span className="w-20 text-right text-gray-600">-{money(totals.discount)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 text-gray-700">
              <label className="inline-flex items-center gap-1"><input type="radio" checked={h.withholdingType === "tds"} onChange={() => setF("withholdingType", "tds")} /> TDS</label>
              <label className="inline-flex items-center gap-1"><input type="radio" checked={h.withholdingType === "tcs"} onChange={() => setF("withholdingType", "tcs")} /> TCS</label>
              {h.withholdingType && <button onClick={() => { setF("withholdingType", ""); setF("withholdingTaxRateId", ""); }} className="text-xs text-gray-400 hover:text-gray-700">clear</button>}
            </div>
            <div className="flex items-center gap-1">
              <NativeSelect value={h.withholdingTaxRateId} onChange={(e) => setF("withholdingTaxRateId", e.target.value)} disabled={!h.withholdingType} className="bg-white border border-gray-300 rounded-md px-2 py-1 text-sm disabled:opacity-50"><option value="">Select a Tax</option>{taxRates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect>
              <span className="w-20 text-right text-gray-600">{h.withholdingType === "tcs" ? "+" : "-"}{money(totals.wh)}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-gray-700">Adjustment</span>
            <input type="number" value={h.adjustment} onChange={(e) => setF("adjustment", e.target.value)} className="w-24 bg-white border border-gray-300 rounded-md px-2 py-1 text-right text-sm" />
          </div>
          <div className="flex justify-between pt-3 border-t border-gray-200 text-base font-semibold text-gray-900"><span>Total</span><span>{money(totals.total)}</span></div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-3 flex gap-2 z-10">
        <button onClick={() => save(false)} disabled={saving || !workspaceId} className="px-5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium rounded-md">{saving ? "Saving…" : "Save as Draft"}</button>
        <button onClick={() => save(true)} disabled={saving || !workspaceId} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">Save and Send</button>
        <Link href="/dashboard/invoices" className="px-5 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium">Cancel</Link>
      </div>
    </div>
  );
}

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className={`text-sm ${required ? "text-red-600" : "text-gray-700"}`}>{label}{required ? "*" : ""}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
