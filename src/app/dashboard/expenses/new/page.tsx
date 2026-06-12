"use client";

import { NativeSelect, DateInput } from "@/components/ui";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Add as Plus, Delete as Trash2, Alert as AlertCircle, Upload } from "@vibe/icons";

interface Workspace { id: string; name: string }
interface Account { id: string; name: string; code: string; type: string }
interface Vendor { id: string; name: string }
interface Customer { id: string; name: string }
interface TaxRate { id: string; name: string; rateBasisPoints: number }

const GST_TREATMENTS = [
  ["registered_business_regular", "Registered Business - Regular"],
  ["registered_business_composition", "Registered Business - Composition"],
  ["unregistered_business", "Unregistered Business"],
  ["consumer", "Consumer"],
  ["overseas", "Overseas"],
  ["special_economic_zone", "SEZ"],
  ["deemed_export", "Deemed Export"],
];
const CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED", "AUD", "CAD"];
const inp = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:border-blue-500";

export default function NewExpensePage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);
  const [mode, setMode] = useState<"expense" | "mileage">("expense");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [f, setF] = useState({
    spentAt: new Date().toISOString().slice(0, 10),
    expenseAccountId: "", amount: "", currency: "INR", paidThroughAccountId: "",
    expenseType: "services", sacCode: "", vendorId: "", gstTreatment: "",
    sourceOfSupply: "", destinationOfSupply: "", reverseCharge: false,
    taxRateId: "", taxInclusive: false, invoiceNumber: "", description: "",
    customerId: "", billable: false,
    mileageDistance: "", mileageRate: "",
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const [tags, setTags] = useState<{ k: string; v: string }[]>([]);

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
      g(`/api/accounts?workspaceId=${workspaceId}`), g(`/api/vendors?workspaceId=${workspaceId}&status=active`),
      g(`/api/customers?workspaceId=${workspaceId}`), g(`/api/tax-rates?workspaceId=${workspaceId}`),
    ]).then(([ac, ve, cu, tx]) => { setAccounts(ac); setVendors(ve); setCustomers(cu); setTaxRates(tx); });
  }, [workspaceId]);

  const expenseAccounts = useMemo(() => accounts.filter((a) => a.type === "expense"), [accounts]);
  const paidThroughAccounts = useMemo(() => accounts.filter((a) => a.type === "asset"), [accounts]);

  const save = async (andNew: boolean) => {
    if (mode === "expense" && (!f.amount || Number(f.amount) <= 0)) { setError("Amount must be greater than 0"); return; }
    if (mode === "mileage" && (!f.mileageDistance || !f.mileageRate)) { setError("Enter distance and rate"); return; }
    setSaving(true); setError("");
    const reportingTags = Object.fromEntries(tags.filter((x) => x.k.trim()).map((x) => [x.k.trim(), x.v]));
    const body = {
      workspaceId, kind: mode === "mileage" ? "mileage" : "general",
      spentAt: f.spentAt ? new Date(f.spentAt).toISOString() : undefined,
      expenseAccountId: f.expenseAccountId || undefined,
      paidThroughAccountId: f.paidThroughAccountId || undefined,
      amount: mode === "expense" ? Number(f.amount) : undefined,
      currency: f.currency,
      mileageDistance: mode === "mileage" ? Number(f.mileageDistance) : undefined,
      mileageRate: mode === "mileage" ? Number(f.mileageRate) : undefined,
      expenseType: f.expenseType, sacCode: f.sacCode || undefined,
      vendorId: f.vendorId || undefined, gstTreatment: f.gstTreatment || undefined,
      sourceOfSupply: f.sourceOfSupply || undefined, destinationOfSupply: f.destinationOfSupply || undefined,
      reverseCharge: f.reverseCharge, taxRateId: f.taxRateId || undefined, taxInclusive: f.taxInclusive,
      invoiceNumber: f.invoiceNumber || undefined, description: f.description || undefined,
      customerId: f.customerId || undefined, billable: f.billable,
      reportingTags,
    };
    const res = await fetch("/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to save"); return; }
    if (andNew) { setF((p) => ({ ...p, amount: "", invoiceNumber: "", description: "", sacCode: "" })); setTags([]); return; }
    router.push("/dashboard/expenses");
  };

  return (
    <div className="p-8 max-w-5xl mx-auto pb-28">
      <Link href="/dashboard/expenses" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3"><ArrowLeft className="h-4 w-4" /> Expenses</Link>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-6 mb-6">
        <button onClick={() => setMode("expense")} className={`px-1 pb-2 text-sm font-medium border-b-2 -mb-px ${mode === "expense" ? "border-blue-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}>Record Expense</button>
        <button onClick={() => setMode("mileage")} className={`px-1 pb-2 text-sm font-medium border-b-2 -mb-px ${mode === "mileage" ? "border-blue-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}>Record Mileage</button>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      {workspaces.length > 1 && (
        <div className="mb-5"><label className="text-xs text-gray-500">Workspace</label>
          <NativeSelect value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className={`${inp} max-w-xs mt-1`}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</NativeSelect>
        </div>
      )}

      <div className="grid grid-cols-[1fr_320px] gap-8">
        <div className="space-y-4">
          <Row label="Date" required><DateInput value={f.spentAt} onChange={(e) => set("spentAt", e.target.value)} /></Row>

          <Row label="Expense Account" required>
            <NativeSelect value={f.expenseAccountId} onChange={(e) => set("expenseAccountId", e.target.value)} className={inp}>
              <option value="">Select an account</option>
              {expenseAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </NativeSelect>
          </Row>

          {mode === "expense" ? (
            <Row label="Amount" required>
              <div className="flex">
                <NativeSelect value={f.currency} onChange={(e) => set("currency", e.target.value)} className="bg-white border border-gray-300 rounded-l-md px-2 py-2 text-sm text-gray-900 border-r-0">{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</NativeSelect>
                <input type="number" step="0.01" value={f.amount} onChange={(e) => set("amount", e.target.value)} className="w-full bg-white border border-gray-300 rounded-r-md px-3 py-2 text-sm text-gray-900 focus:border-blue-500" />
              </div>
            </Row>
          ) : (
            <>
              <Row label="Distance" required><input type="number" step="0.1" value={f.mileageDistance} onChange={(e) => set("mileageDistance", e.target.value)} className={inp} /></Row>
              <Row label="Rate / unit" required>
                <div className="flex">
                  <NativeSelect value={f.currency} onChange={(e) => set("currency", e.target.value)} className="bg-white border border-gray-300 rounded-l-md px-2 py-2 text-sm text-gray-900 border-r-0">{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</NativeSelect>
                  <input type="number" step="0.01" value={f.mileageRate} onChange={(e) => set("mileageRate", e.target.value)} className="w-full bg-white border border-gray-300 rounded-r-md px-3 py-2 text-sm text-gray-900 focus:border-blue-500" />
                </div>
              </Row>
            </>
          )}

          <Row label="Paid Through" required>
            <NativeSelect value={f.paidThroughAccountId} onChange={(e) => set("paidThroughAccountId", e.target.value)} className={inp}>
              <option value="">Select an account</option>
              {paidThroughAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </NativeSelect>
          </Row>

          <Row label="Expense Type" required>
            <div className="flex items-center gap-6 text-sm text-gray-900 pt-1">
              <label className="inline-flex items-center gap-2"><input type="radio" checked={f.expenseType === "goods"} onChange={() => set("expenseType", "goods")} /> Goods</label>
              <label className="inline-flex items-center gap-2"><input type="radio" checked={f.expenseType === "services"} onChange={() => set("expenseType", "services")} /> Services</label>
            </div>
          </Row>

          <Row label="SAC"><input value={f.sacCode} onChange={(e) => set("sacCode", e.target.value)} className={inp} /></Row>

          <Row label="Vendor">
            <NativeSelect value={f.vendorId} onChange={(e) => set("vendorId", e.target.value)} className={inp}><option value="">Select a vendor</option>{vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</NativeSelect>
          </Row>

          <Row label="GST Treatment" required>
            <NativeSelect value={f.gstTreatment} onChange={(e) => set("gstTreatment", e.target.value)} className={inp}><option value="">Select a GST treatment</option>{GST_TREATMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
          </Row>

          <Row label="Source of Supply" required><input value={f.sourceOfSupply} onChange={(e) => set("sourceOfSupply", e.target.value)} placeholder="State / Province" className={inp} /></Row>
          <Row label="Destination of Supply" required><input value={f.destinationOfSupply} onChange={(e) => set("destinationOfSupply", e.target.value)} placeholder="State / Province" className={inp} /></Row>

          <Row label="Reverse Charge">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 pt-1"><input type="checkbox" checked={f.reverseCharge} onChange={(e) => set("reverseCharge", e.target.checked)} /> This transaction is applicable for reverse charge</label>
          </Row>

          <Row label="Tax">
            <NativeSelect value={f.taxRateId} onChange={(e) => set("taxRateId", e.target.value)} className={inp}><option value="">Select a Tax</option>{taxRates.map((t) => <option key={t.id} value={t.id}>{t.name} ({(t.rateBasisPoints / 100).toFixed(0)}%)</option>)}</NativeSelect>
          </Row>

          <Row label="Amount Is">
            <div className="flex items-center gap-6 text-sm text-gray-900 pt-1">
              <label className="inline-flex items-center gap-2"><input type="radio" checked={f.taxInclusive} onChange={() => set("taxInclusive", true)} /> Tax Inclusive</label>
              <label className="inline-flex items-center gap-2"><input type="radio" checked={!f.taxInclusive} onChange={() => set("taxInclusive", false)} /> Tax Exclusive</label>
            </div>
          </Row>

          <Row label="Invoice#" required><input value={f.invoiceNumber} onChange={(e) => set("invoiceNumber", e.target.value)} className={inp} /></Row>

          <Row label="Notes"><textarea value={f.description} onChange={(e) => set("description", e.target.value)} rows={3} maxLength={500} placeholder="Max. 500 characters" className={inp} /></Row>

          <div className="border-t border-gray-200 pt-4 space-y-4">
            <Row label="Customer Name">
              <NativeSelect value={f.customerId} onChange={(e) => set("customerId", e.target.value)} className={inp}><option value="">Select or add a customer</option>{customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
            </Row>
            {f.customerId && (
              <Row label="Billable">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 pt-1"><input type="checkbox" checked={f.billable} onChange={(e) => set("billable", e.target.checked)} /> Mark as billable to customer</label>
              </Row>
            )}
            <Row label="Reporting Tags">
              <div className="space-y-2">
                {tags.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input value={r.k} onChange={(e) => setTags(tags.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} placeholder="Tag" className={inp} />
                    <input value={r.v} onChange={(e) => setTags(tags.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} placeholder="Value" className={inp} />
                    <button onClick={() => setTags(tags.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <button onClick={() => setTags([...tags, { k: "", v: "" }])} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"><Plus className="h-4 w-4" /> Associate Tags</button>
              </div>
            </Row>
          </div>
        </div>

        {/* Receipt drop zone (visual; upload wired to existing receipt flow later) */}
        <div className="h-fit">
          <div className="border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500">
            <Upload className="h-8 w-8 mx-auto mb-3 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">Drag or Drop your Receipts</p>
            <p className="text-xs mt-1">Maximum file size allowed is 10MB</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-3 flex gap-2 z-10">
        <button onClick={() => save(false)} disabled={saving || !workspaceId} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Save"}</button>
        <button onClick={() => save(true)} disabled={saving || !workspaceId} className="px-5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium rounded-md">Save and New</button>
        <Link href="/dashboard/expenses" className="px-5 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium">Cancel</Link>
      </div>
    </div>
  );
}

function Row({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] items-start gap-4">
      <label className={`text-sm pt-2 ${required ? "text-red-600" : "text-gray-700"}`}>{label}{required ? "*" : ""}</label>
      <div className="max-w-xl">{children}</div>
    </div>
  );
}
