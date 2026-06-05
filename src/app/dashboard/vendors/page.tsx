"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Building2, Pencil, Trash2, X, AlertCircle } from "lucide-react";
import ImportExport from "@/components/ImportExport";

interface Workspace { id: string; name: string; color: string }
interface Vendor {
  id: string;
  workspaceId: string;
  code: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  paymentTermsDays: number;
  notes: string | null;
  status: "active" | "inactive";
  createdAt: string;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-600",
  inactive: "bg-gray-600/40 text-gray-600",
};

const emptyForm = { name: "", code: "", email: "", phone: "", taxId: "", paymentTermsDays: "30", notes: "" };

export default function VendorsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Vendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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
    const res = await fetch(`/api/vendors?workspaceId=${workspaceId}`);
    const data = await res.json();
    setVendors(res.ok && Array.isArray(data.data) ? data.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const openEdit = (v: Vendor) => {
    setEditTarget(v);
    setForm({
      name: v.name, code: v.code ?? "", email: v.email ?? "", phone: v.phone ?? "",
      taxId: v.taxId ?? "", paymentTermsDays: String(v.paymentTermsDays), notes: v.notes ?? "",
    });
    setError("");
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const payload = {
      name: form.name.trim(),
      code: form.code.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      taxId: form.taxId.trim() || undefined,
      paymentTermsDays: Number(form.paymentTermsDays) || 0,
      notes: form.notes.trim() || undefined,
    };
    const res = editTarget
      ? await fetch(`/api/vendors/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(`/api/vendors`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, workspaceId }) });
    setSaving(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to save"); return; }
    setShowModal(false);
    load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/vendors/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    load();
  };

  const filtered = vendors.filter((v) =>
    [v.name, v.code, v.email].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold text-gray-900">Vendors</h1>
        </div>
        <div className="flex items-center gap-2">
          <ImportExport entity="vendors" workspaceId={workspaceId} onImported={load} />
          <Link
            href={workspaceId ? `/dashboard/vendors/new?workspaceId=${workspaceId}` : "/dashboard/vendors/new"}
            className={`flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-md transition-colors ${!workspaceId ? "pointer-events-none opacity-50" : ""}`}
          >
            <Plus className="h-4 w-4" /> New Vendor
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <select
          value={workspaceId}
          onChange={(e) => setWorkspaceId(e.target.value)}
          className="bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900"
        >
          {workspaces.length === 0 && <option value="">No workspaces</option>}
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vendors…"
            className="w-full bg-white border border-gray-200 rounded-md pl-9 pr-3 py-2 text-sm text-gray-900 placeholder-gray-500"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Terms</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No vendors yet.</td></tr>
            ) : filtered.map((v) => (
              <tr key={v.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-4 py-3"><a href={`/dashboard/vendors/${v.id}`} className="text-blue-600 hover:underline font-medium">{v.name}</a></td>
                <td className="px-4 py-3 text-gray-600">{v.code || "—"}</td>
                <td className="px-4 py-3 text-gray-600">{v.email || "—"}</td>
                <td className="px-4 py-3 text-gray-600">Net {v.paymentTermsDays}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[v.status]}`}>{v.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEdit(v)} className="p-1.5 text-gray-500 hover:text-gray-900" title="Edit"><Pencil className="h-4 w-4" /></button>
                  {deleteConfirm === v.id ? (
                    <span className="inline-flex items-center gap-1">
                      <button onClick={() => remove(v.id)} className="p-1.5 text-red-600 hover:text-red-600" title="Confirm delete"><Trash2 className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-gray-500 hover:text-gray-700"><X className="h-4 w-4" /></button>
                    </span>
                  ) : (
                    <button onClick={() => setDeleteConfirm(v.id)} className="p-1.5 text-gray-500 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{editTarget ? "Edit Vendor" : "New Vendor"}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            {error && (
              <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-500/10 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} className="col-span-2" />
              <Field label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
              <Field label="Payment terms (days)" value={form.paymentTermsDays} onChange={(v) => setForm({ ...form, paymentTermsDays: v })} type="number" />
              <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
              <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <Field label="Tax ID" value={form.taxId} onChange={(v) => setForm({ ...form, taxId: v })} className="col-span-2" />
              <Field label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} className="col-span-2" />
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-md">
                {saving ? "Saving…" : editTarget ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", className = "" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900"
      />
    </label>
  );
}
