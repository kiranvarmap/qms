"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, AlertCircle, ArrowDown } from "lucide-react";

interface Workspace { id: string; name: string }
type Tab = "other" | "address" | "contacts" | "custom" | "tags" | "remarks";

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
const PAYMENT_TERMS = [
  ["due_on_receipt", "Due on Receipt"], ["net15", "Net 15"], ["net30", "Net 30"], ["net45", "Net 45"], ["net60", "Net 60"],
];
const inp = "w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:border-blue-500";

const emptyAddr = { attention: "", country: "", line1: "", line2: "", city: "", state: "", postalCode: "", phone: "", fax: "" };
type Addr = typeof emptyAddr;
type Contact = { salutation: string; firstName: string; lastName: string; email: string; workPhone: string; mobile: string };
const emptyContact: Contact = { salutation: "", firstName: "", lastName: "", email: "", workPhone: "", mobile: "" };

export default function NewCustomerPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [tab, setTab] = useState<Tab>("other");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [f, setF] = useState({
    customerType: "business", salutation: "", firstName: "", lastName: "", companyName: "",
    displayName: "", email: "", workPhone: "", mobile: "", customerLanguage: "English",
    gstTreatment: "", placeOfSupply: "", gstin: "", pan: "", taxPreference: "taxable",
    currency: "INR", openingBalance: "", paymentTermsLabel: "due_on_receipt", enablePortal: false, notes: "",
  });
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const [billing, setBilling] = useState<Addr>({ ...emptyAddr });
  const [shipping, setShipping] = useState<Addr>({ ...emptyAddr });
  const [contacts, setContacts] = useState<Contact[]>([{ ...emptyContact }]);
  const [customFields, setCustomFields] = useState<{ k: string; v: string }[]>([]);
  const [tags, setTags] = useState<{ k: string; v: string }[]>([]);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id);
    }).catch(() => {});
  }, []);

  const save = async () => {
    if (!f.displayName.trim()) { setError("Display Name is required"); setTab("other"); return; }
    setSaving(true); setError("");
    const cf = Object.fromEntries(customFields.filter((x) => x.k.trim()).map((x) => [x.k.trim(), x.v]));
    const rt = Object.fromEntries(tags.filter((x) => x.k.trim()).map((x) => [x.k.trim(), x.v]));
    const body = {
      workspaceId,
      customerType: f.customerType, salutation: f.salutation || undefined, firstName: f.firstName || undefined,
      lastName: f.lastName || undefined, companyName: f.companyName || undefined, displayName: f.displayName.trim(),
      email: f.email || undefined, workPhone: f.workPhone || undefined, mobile: f.mobile || undefined,
      customerLanguage: f.customerLanguage, gstTreatment: f.gstTreatment || undefined, placeOfSupply: f.placeOfSupply || undefined,
      gstin: f.gstin || undefined, pan: f.pan || undefined, taxPreference: f.taxPreference,
      currency: f.currency, openingBalance: f.openingBalance ? Number(f.openingBalance) : undefined,
      paymentTermsLabel: f.paymentTermsLabel, enablePortal: f.enablePortal,
      billingAddress: billing, shippingAddress: shipping,
      contacts: contacts.filter((c) => c.firstName || c.lastName || c.email),
      customFields: cf, reportingTags: rt, notes: f.notes || undefined,
    };
    const res = await fetch("/api/customers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to save"); return; }
    router.push("/dashboard/customers");
  };

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)} className={`px-1 pb-2 text-sm font-medium border-b-2 -mb-px ${tab === id ? "border-blue-600 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-800"}`}>{label}</button>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto pb-28">
      <Link href="/dashboard/customers" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3"><ArrowLeft className="h-4 w-4" /> Customers</Link>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">New Customer</h1>

      {error && <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      {workspaces.length > 1 && (
        <div className="mb-5"><label className="text-xs text-gray-500">Workspace</label>
          <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className={`${inp} max-w-xs mt-1`}>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        </div>
      )}

      {/* ── Identity ─────────────────────────────────── */}
      <div className="space-y-4">
        <Row label="Customer Type">
          <div className="flex items-center gap-6 text-sm text-gray-900">
            <label className="inline-flex items-center gap-2"><input type="radio" checked={f.customerType === "business"} onChange={() => set("customerType", "business")} /> Business</label>
            <label className="inline-flex items-center gap-2"><input type="radio" checked={f.customerType === "individual"} onChange={() => set("customerType", "individual")} /> Individual</label>
          </div>
        </Row>
        <Row label="Primary Contact">
          <div className="grid grid-cols-3 gap-2">
            <select value={f.salutation} onChange={(e) => set("salutation", e.target.value)} className={inp}><option value="">Salutation</option><option>Mr.</option><option>Mrs.</option><option>Ms.</option><option>Dr.</option></select>
            <input value={f.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="First Name" className={inp} />
            <input value={f.lastName} onChange={(e) => set("lastName", e.target.value)} placeholder="Last Name" className={inp} />
          </div>
        </Row>
        <Row label="Company Name"><input value={f.companyName} onChange={(e) => set("companyName", e.target.value)} className={inp} /></Row>
        <Row label="Display Name" required><input value={f.displayName} onChange={(e) => set("displayName", e.target.value)} placeholder="Select or type to add" className={inp} /></Row>
        <Row label="Email Address"><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} className={inp} /></Row>
        <Row label="Phone">
          <div className="grid grid-cols-2 gap-2">
            <input value={f.workPhone} onChange={(e) => set("workPhone", e.target.value)} placeholder="Work Phone" className={inp} />
            <input value={f.mobile} onChange={(e) => set("mobile", e.target.value)} placeholder="Mobile" className={inp} />
          </div>
        </Row>
        <Row label="Customer Language">
          <select value={f.customerLanguage} onChange={(e) => set("customerLanguage", e.target.value)} className={`${inp} max-w-xs`}><option>English</option><option>Hindi</option><option>Spanish</option><option>French</option><option>German</option><option>Arabic</option></select>
        </Row>
      </div>

      {/* ── Tabs ─────────────────────────────────── */}
      <div className="mt-8 border-b border-gray-200 flex gap-6">
        <TabBtn id="other" label="Other Details" /><TabBtn id="address" label="Address" /><TabBtn id="contacts" label="Contact Persons" />
        <TabBtn id="custom" label="Custom Fields" /><TabBtn id="tags" label="Reporting Tags" /><TabBtn id="remarks" label="Remarks" />
      </div>

      <div className="py-6">
        {tab === "other" && (
          <div className="space-y-4 max-w-2xl">
            <Row label="GST Treatment"><select value={f.gstTreatment} onChange={(e) => set("gstTreatment", e.target.value)} className={inp}><option value="">Select a GST treatment</option>{GST_TREATMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row>
            <Row label="Place of Supply"><input value={f.placeOfSupply} onChange={(e) => set("placeOfSupply", e.target.value)} placeholder="State / state code" className={inp} /></Row>
            <Row label="GSTIN"><input value={f.gstin} onChange={(e) => set("gstin", e.target.value)} className={inp} /></Row>
            <Row label="PAN"><input value={f.pan} onChange={(e) => set("pan", e.target.value)} className={inp} /></Row>
            <Row label="Tax Preference">
              <div className="flex items-center gap-6 text-sm text-gray-900">
                <label className="inline-flex items-center gap-2"><input type="radio" checked={f.taxPreference === "taxable"} onChange={() => set("taxPreference", "taxable")} /> Taxable</label>
                <label className="inline-flex items-center gap-2"><input type="radio" checked={f.taxPreference === "tax_exempt"} onChange={() => set("taxPreference", "tax_exempt")} /> Tax Exempt</label>
              </div>
            </Row>
            <Row label="Currency"><select value={f.currency} onChange={(e) => set("currency", e.target.value)} className={inp}>{CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></Row>
            <Row label="Opening Balance"><input type="number" value={f.openingBalance} onChange={(e) => set("openingBalance", e.target.value)} className={inp} /></Row>
            <Row label="Payment Terms"><select value={f.paymentTermsLabel} onChange={(e) => set("paymentTermsLabel", e.target.value)} className={inp}>{PAYMENT_TERMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Row>
            <Row label="Enable Portal?"><label className="inline-flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={f.enablePortal} onChange={(e) => set("enablePortal", e.target.checked)} /> Allow portal access for this customer</label></Row>
          </div>
        )}

        {tab === "address" && (
          <div className="grid grid-cols-2 gap-8">
            <AddressBlock title="Billing Address" addr={billing} onChange={setBilling} />
            <AddressBlock title="Shipping Address" addr={shipping} onChange={setShipping} copyFrom={() => setShipping({ ...billing })} />
          </div>
        )}

        {tab === "contacts" && (
          <div>
            <table className="w-full text-sm mb-3">
              <thead><tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="px-2 py-2 font-medium">Salutation</th><th className="px-2 py-2 font-medium">First Name</th><th className="px-2 py-2 font-medium">Last Name</th><th className="px-2 py-2 font-medium">Email</th><th className="px-2 py-2 font-medium">Work Phone</th><th className="px-2 py-2 font-medium">Mobile</th><th></th>
              </tr></thead>
              <tbody>
                {contacts.map((c, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-1 py-1"><select value={c.salutation} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, salutation: e.target.value } : x))} className={inp}><option value=""></option><option>Mr.</option><option>Mrs.</option><option>Ms.</option><option>Dr.</option></select></td>
                    <td className="px-1 py-1"><input value={c.firstName} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, firstName: e.target.value } : x))} className={inp} /></td>
                    <td className="px-1 py-1"><input value={c.lastName} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, lastName: e.target.value } : x))} className={inp} /></td>
                    <td className="px-1 py-1"><input value={c.email} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, email: e.target.value } : x))} className={inp} /></td>
                    <td className="px-1 py-1"><input value={c.workPhone} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, workPhone: e.target.value } : x))} className={inp} /></td>
                    <td className="px-1 py-1"><input value={c.mobile} onChange={(e) => setContacts(contacts.map((x, j) => j === i ? { ...x, mobile: e.target.value } : x))} className={inp} /></td>
                    <td className="px-1 py-1">{contacts.length > 1 && <button onClick={() => setContacts(contacts.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setContacts([...contacts, { ...emptyContact }])} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"><Plus className="h-4 w-4" /> Add Contact Person</button>
          </div>
        )}

        {tab === "custom" && <KeyValue label="custom field" rows={customFields} setRows={setCustomFields} />}
        {tab === "tags" && <KeyValue label="reporting tag" rows={tags} setRows={setTags} />}
        {tab === "remarks" && (
          <div className="max-w-2xl">
            <label className="text-sm text-gray-900">Remarks <span className="text-gray-400">(For Internal Use)</span></label>
            <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={5} className={`${inp} mt-2`} />
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-8 py-3 flex gap-2 z-10">
        <button onClick={save} disabled={saving || !workspaceId} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Save"}</button>
        <Link href="/dashboard/customers" className="px-5 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-md">Cancel</Link>
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

function AddressBlock({ title, addr, onChange, copyFrom }: { title: string; addr: Addr; onChange: (a: Addr) => void; copyFrom?: () => void }) {
  const u = (k: keyof Addr, v: string) => onChange({ ...addr, [k]: v });
  return (
    <div>
      <div className="flex items-center gap-3 mb-4"><h3 className="font-semibold text-gray-900">{title}</h3>{copyFrom && <button onClick={copyFrom} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"><ArrowDown className="h-3.5 w-3.5" /> Copy billing address</button>}</div>
      <div className="space-y-3">
        <Field label="Attention" v={addr.attention} on={(v) => u("attention", v)} />
        <Field label="Country/Region" v={addr.country} on={(v) => u("country", v)} />
        <Field label="Address" v={addr.line1} on={(v) => u("line1", v)} placeholder="Street 1" />
        <Field label="" v={addr.line2} on={(v) => u("line2", v)} placeholder="Street 2" />
        <Field label="City" v={addr.city} on={(v) => u("city", v)} />
        <Field label="State" v={addr.state} on={(v) => u("state", v)} />
        <Field label="Pin Code" v={addr.postalCode} on={(v) => u("postalCode", v)} />
        <Field label="Phone" v={addr.phone} on={(v) => u("phone", v)} />
        <Field label="Fax Number" v={addr.fax} on={(v) => u("fax", v)} />
      </div>
    </div>
  );
}

function Field({ label, v, on, placeholder }: { label: string; v: string; on: (v: string) => void; placeholder?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3">
      <label className="text-sm text-gray-600">{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
    </div>
  );
}

function KeyValue({ label, rows, setRows }: { label: string; rows: { k: string; v: string }[]; setRows: (r: { k: string; v: string }[]) => void }) {
  return (
    <div className="max-w-2xl">
      <div className="space-y-2 mb-3">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-2">
            <input value={r.k} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, k: e.target.value } : x))} placeholder="Label" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
            <input value={r.v} onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, v: e.target.value } : x))} placeholder="Value" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-gray-500">No {label}s added.</p>}
      </div>
      <button onClick={() => setRows([...rows, { k: "", v: "" }])} className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"><Plus className="h-4 w-4" /> Add {label}</button>
    </div>
  );
}
