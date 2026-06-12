"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Notifications as Bell, Check } from "@vibe/icons";

// The notifiable events (mirrors the runNotifications catalogue + targeted
// pings). '*' would be a global default; we keep explicit rows per event.
const EVENTS: { eventType: string; label: string; group: string }[] = [
  { eventType: "inspection.flagged", label: "Inspection flagged", group: "Quality & safety" },
  { eventType: "inspection.submitted", label: "Inspection submitted", group: "Quality & safety" },
  { eventType: "ncr.raised", label: "NCR raised", group: "Quality & safety" },
  { eventType: "incident.reported", label: "Incident reported", group: "Quality & safety" },
  { eventType: "stock.low", label: "Low stock", group: "Supply chain" },
  { eventType: "po.received", label: "Goods received", group: "Supply chain" },
  { eventType: "estimate.accepted", label: "Estimate accepted", group: "Sales & finance" },
  { eventType: "estimate.rejected", label: "Estimate rejected", group: "Sales & finance" },
  { eventType: "invoice.paid", label: "Invoice paid", group: "Sales & finance" },
  { eventType: "invoice.overdue", label: "Invoice overdue", group: "Sales & finance" },
  { eventType: "approval.requested", label: "Approval assigned to me", group: "Approvals" },
  { eventType: "approval.approved", label: "My request approved", group: "Approvals" },
  { eventType: "approval.rejected", label: "My request rejected", group: "Approvals" },
  { eventType: "certification.expiring", label: "Certification expiring", group: "People" },
  { eventType: "signdoc.completed", label: "Document signed", group: "Documents" },
];

interface Pref { eventType: string; inApp: boolean; email: boolean }

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<Record<string, Pref>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/notification-preferences")
      .then((r) => r.json())
      .then((d) => {
        const map: Record<string, Pref> = {};
        for (const e of EVENTS) map[e.eventType] = { eventType: e.eventType, inApp: true, email: false };
        if (Array.isArray(d.data)) for (const p of d.data) map[p.eventType] = p;
        setPrefs(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (eventType: string, channel: "inApp" | "email") => {
    setPrefs((prev) => ({
      ...prev,
      [eventType]: { ...prev[eventType], [channel]: !prev[eventType]?.[channel] },
    }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/notification-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: Object.values(prefs) }),
    });
    setSaving(false);
    setSaved(true);
  };

  const groups = [...new Set(EVENTS.map((e) => e.group))];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Notification preferences</h1>
            <p className="text-sm text-gray-500">Choose how each kind of event reaches you.</p>
          </div>
        </div>
        <button onClick={save} disabled={saving || loading} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">
          {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? "Saving…" : "Save"}
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-16">Loading…</div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 flex items-center">
                <h2 className="text-sm font-semibold text-gray-700">{group}</h2>
                <span className="ml-auto text-[11px] text-gray-400 w-16 text-center">In-app</span>
                <span className="text-[11px] text-gray-400 w-16 text-center">Email</span>
              </div>
              {EVENTS.filter((e) => e.group === group).map((e) => (
                <div key={e.eventType} className="px-4 py-2.5 border-b border-gray-100 last:border-0 flex items-center">
                  <span className="text-sm text-gray-900">{e.label}</span>
                  <span className="ml-auto w-16 text-center">
                    <input type="checkbox" checked={prefs[e.eventType]?.inApp ?? true} onChange={() => toggle(e.eventType, "inApp")} className="h-4 w-4 accent-blue-600" />
                  </span>
                  <span className="w-16 text-center">
                    <input type="checkbox" checked={prefs[e.eventType]?.email ?? false} onChange={() => toggle(e.eventType, "email")} className="h-4 w-4 accent-blue-600" />
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
