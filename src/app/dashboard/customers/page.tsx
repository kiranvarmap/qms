"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Users2, KeyRound, X, AlertCircle } from "lucide-react";

interface Workspace { id: string; name: string }
interface Customer { id: string; name: string; email: string | null; phone: string | null; status: string }
interface PortalContact { id: string; name: string; email: string; status: string; lastLoginAt: string | null }

const emptyCustomer = { name: "", email: "", phone: "" };
const emptyContact = { name: "", email: "", password: "" };

export default function CustomersPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [portalFor, setPortalFor] = useState<Customer | null>(null);
  const [contacts, setContacts] = useState<PortalContact[]>([]);
  const [contactForm, setContactForm] = useState(emptyContact);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data: Workspace[]) => {
        setWorkspaces(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) setWorkspaceId(data[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const res = await fetch(`/api/customers?workspaceId=${workspaceId}`);
    const data = await res.json();
    setCustomers(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const createCustomer = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/customers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name: form.name.trim(), email: form.email.trim() || undefined, phone: form.phone.trim() || undefined }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setShowCreate(false); setForm(emptyCustomer); load();
  };

  const openPortal = async (c: Customer) => {
    setPortalFor(c); setContactForm(emptyContact); setError("");
    const res = await fetch(`/api/portal-contacts?workspaceId=${workspaceId}&customerId=${c.id}`);
    const data = await res.json();
    setContacts(res.ok && Array.isArray(data.data) ? data.data : []);
  };

  const addContact = async () => {
    if (!portalFor) return;
    if (!contactForm.name.trim() || !contactForm.email.trim() || contactForm.password.length < 8) {
      setError("Name, email, and an 8+ char password are required"); return;
    }
    setSaving(true); setError("");
    const res = await fetch("/api/portal-contacts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, customerId: portalFor.id, name: contactForm.name.trim(), email: contactForm.email.trim(), password: contactForm.password }),
    });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); return; }
    setContactForm(emptyContact);
    openPortal(portalFor);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users2 className="h-6 w-6 text-blue-400" />
          <h1 className="text-xl font-semibold text-white">Customers</h1>
        </div>
        <button onClick={() => { setForm(emptyCustomer); setError(""); setShowCreate(true); }} disabled={!workspaceId} className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          <Plus className="h-4 w-4" /> New Customer
        </button>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-4 bg-gray-900 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      <div className="bg-gray-900 border border-white/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-white/10">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Phone</th>
              <th className="px-4 py-3 font-medium text-right">Portal</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">No customers yet.</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-gray-200">{c.name}</td>
                <td className="px-4 py-3 text-gray-400">{c.email || "—"}</td>
                <td className="px-4 py-3 text-gray-400">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openPortal(c)} className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-white/10 text-gray-300 hover:text-white text-xs rounded-md"><KeyRound className="h-3.5 w-3.5" /> Manage access</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <Modal title="New Customer" onClose={() => setShowCreate(false)} error={error}>
          <div className="space-y-3">
            <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          </div>
          <Actions saving={saving} onCancel={() => setShowCreate(false)} onSave={createCustomer} label="Create" />
        </Modal>
      )}

      {portalFor && (
        <Modal title={`Portal access — ${portalFor.name}`} onClose={() => setPortalFor(null)} error={error}>
          <div className="mb-4">
            {contacts.length === 0 ? (
              <p className="text-sm text-gray-500">No portal logins yet.</p>
            ) : (
              <div className="space-y-1">
                {contacts.map((ct) => (
                  <div key={ct.id} className="flex justify-between text-sm bg-gray-950 rounded-md px-3 py-2">
                    <span className="text-gray-200">{ct.name} <span className="text-gray-500">· {ct.email}</span></span>
                    <span className="text-gray-500">{ct.lastLoginAt ? `last in ${new Date(ct.lastLoginAt).toLocaleDateString()}` : "never"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-white/10 pt-3 space-y-3">
            <p className="text-xs text-gray-500">Add a login (the contact signs in at <code>/portal</code>).</p>
            <Field label="Name" value={contactForm.name} onChange={(v) => setContactForm({ ...contactForm, name: v })} />
            <Field label="Email" value={contactForm.email} onChange={(v) => setContactForm({ ...contactForm, email: v })} />
            <Field label="Password (8+ chars)" value={contactForm.password} onChange={(v) => setContactForm({ ...contactForm, password: v })} type="password" />
          </div>
          <Actions saving={saving} onCancel={() => setPortalFor(null)} onSave={addContact} label="Add login" />
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, error, children }: { title: string; onClose: () => void; error: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-white/10 rounded-lg w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X className="h-5 w-5" /></button>
        </div>
        {error && <div className="mb-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}
        {children}
      </div>
    </div>
  );
}

function Actions({ saving, onCancel, onSave, label }: { saving: boolean; onCancel: () => void; onSave: () => void; label: string }) {
  return (
    <div className="flex justify-end gap-2 mt-5">
      <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200">Close</button>
      <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : label}</button>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full bg-gray-950 border border-white/10 rounded-md px-3 py-2 text-sm text-gray-200" />
    </label>
  );
}
