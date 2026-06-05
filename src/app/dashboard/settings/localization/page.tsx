"use client";

import { useEffect, useState, useCallback } from "react";
import { Globe, Check } from "lucide-react";

interface Workspace { id: string; name: string }
interface Pack { name: string; taxName: string; taxIdLabel: string; vendorDocs: string[]; workforceDocs: string[]; hasSubNationalTax: boolean; }
interface Localization { country: string; currency: string; locale: string; timezone: string; pack: Pack }

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "AU", name: "Australia" },
  { code: "CA", name: "Canada" },
  { code: "DE", name: "Germany" },
];

export default function LocalizationSettingsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [loc, setLoc] = useState<Localization | null>(null);
  const [country, setCountry] = useState("US");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true); setError("");
    const res = await fetch(`/api/workspaces/${workspaceId}/localization`);
    if (res.ok) { const data = await res.json(); setLoc(data); setCountry(data.country); }
    else { setLoc(null); setError(res.status === 403 ? "Admins only" : "Failed to load"); }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const save = async () => {
    setSaving(true); setSaved(false); setError("");
    const res = await fetch(`/api/workspaces/${workspaceId}/localization`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country }) });
    setSaving(false);
    if (res.ok) { const data = await res.json(); setLoc(data); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    else { const e = await res.json().catch(() => ({})); setError(e.error || "Failed"); }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Globe className="h-6 w-6 text-blue-600" />
        <h1 className="text-xl font-semibold text-gray-900">Localization</h1>
      </div>

      <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="mb-6 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
        {workspaces.length === 0 && <option value="">No workspaces</option>}
        {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
      </select>

      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</div>}

      {loading ? <p className="text-gray-500">Loading…</p> : loc && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <p className="text-sm text-gray-500 mb-4">Choose this workspace&apos;s country. Tax regime, tax-ID labels, statutory documents, currency, and formatting adapt automatically.</p>
            <div className="flex items-end gap-3">
              <label className="block">
                <span className="text-xs text-gray-500">Country</span>
                <select value={country} onChange={(e) => setCountry(e.target.value)} className="mt-1 w-64 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </label>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md inline-flex items-center gap-1.5">
                {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
            <h2 className="font-medium text-gray-900 mb-4">Resolved settings — {loc.pack.name}</h2>
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-gray-500">Currency</dt><dd className="text-gray-900">{loc.currency}</dd>
              <dt className="text-gray-500">Locale</dt><dd className="text-gray-900">{loc.locale}</dd>
              <dt className="text-gray-500">Tax regime</dt><dd className="text-gray-900">{loc.pack.taxName}{loc.pack.hasSubNationalTax ? " (sub-national applies)" : ""}</dd>
              <dt className="text-gray-500">Party tax ID</dt><dd className="text-gray-900">{loc.pack.taxIdLabel}</dd>
              <dt className="text-gray-500">Vendor documents</dt><dd className="text-gray-900">{loc.pack.vendorDocs.join(", ")}</dd>
              <dt className="text-gray-500">Workforce documents</dt><dd className="text-gray-900">{loc.pack.workforceDocs.join(", ")}</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
