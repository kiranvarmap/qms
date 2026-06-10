"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Webhook, Zap, Plus, Trash2, Copy, X, AlertCircle } from "lucide-react";

interface Workspace { id: string; name: string }
interface Sub { id: string; name: string; url: string; eventTypes: string[]; isActive: boolean; failCount: number; lastStatus: number | null; lastDeliveredAt: string | null }
interface Recipe { id: string; name: string; eventType: string; actionType: string; isActive: boolean; config: { userId?: string; boardId?: string; titleTemplate?: string } }
interface Board { id: string; name: string }

const COMMON_EVENTS = [
  "invoice.sent", "invoice.paid", "invoice.overdue", "payment.recorded",
  "estimate.accepted", "estimate.rejected", "estimate.expired",
  "salesorder.approved", "shipment.shipped", "shipment.delivered",
  "po.received", "stock.low", "workorder.completed",
  "inspection.flagged", "ncr.raised", "incident.reported",
  "maintenance.scheduled", "maintenance.completed", "asset.status_changed",
  "approval.requested", "approval.overdue", "leave.approved",
  "certification.expiring", "course.completed", "vendor.created",
  "product.created", "customer.created",
];

export default function IntegrationsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [subs, setSubs] = useState<Sub[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newSecret, setNewSecret] = useState<string | null>(null);

  const [showHook, setShowHook] = useState(false);
  const [hookForm, setHookForm] = useState({ name: "", url: "", eventTypes: "" });
  const [showRecipe, setShowRecipe] = useState(false);
  const [recipeForm, setRecipeForm] = useState({ name: "", eventType: "invoice.overdue", actionType: "notify_admins", boardId: "", titleTemplate: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      setWorkspaces(Array.isArray(d) ? d : []);
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id); else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const [hooksRes, recipesRes, boardsRes] = await Promise.all([
      fetch(`/api/webhooks?workspaceId=${workspaceId}`),
      fetch(`/api/recipes?workspaceId=${workspaceId}`),
      fetch(`/api/boards?workspaceId=${workspaceId}`),
    ]);
    const hooks = await hooksRes.json().catch(() => ({}));
    const recs = await recipesRes.json().catch(() => ({}));
    const brds = await boardsRes.json().catch(() => []);
    setSubs(hooksRes.ok && Array.isArray(hooks.data) ? hooks.data : []);
    setRecipes(recipesRes.ok && Array.isArray(recs.data) ? recs.data : []);
    setBoards(Array.isArray(brds) ? brds : Array.isArray(brds.data) ? brds.data : []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const createHook = async () => {
    if (!hookForm.name.trim() || !hookForm.url.trim()) { setError("Name and URL are required"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name: hookForm.name.trim(),
        url: hookForm.url.trim(),
        eventTypes: hookForm.eventTypes.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    setSaving(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Failed to create webhook"); return; }
    setShowHook(false); setHookForm({ name: "", url: "", eventTypes: "" });
    setNewSecret(d.secret ?? null);
    load();
  };

  const createRecipe = async () => {
    if (!recipeForm.name.trim()) { setError("Name is required"); return; }
    if (recipeForm.actionType === "create_task" && !recipeForm.boardId) { setError("Pick a board for the task"); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        name: recipeForm.name.trim(),
        eventType: recipeForm.eventType,
        actionType: recipeForm.actionType,
        config: recipeForm.actionType === "create_task"
          ? { boardId: recipeForm.boardId, titleTemplate: recipeForm.titleTemplate.trim() || undefined }
          : {},
      }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Failed to create recipe"); return; }
    setShowRecipe(false); setRecipeForm({ name: "", eventType: "invoice.overdue", actionType: "notify_admins", boardId: "", titleTemplate: "" });
    load();
  };

  const toggle = async (kind: "webhooks" | "recipes", id: string, isActive: boolean) => {
    await fetch(`/api/${kind}/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !isActive }) });
    load();
  };
  const remove = async (kind: "webhooks" | "recipes", id: string) => {
    await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Dashboard</Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Automations & Integrations</h1>
          <p className="text-sm text-gray-500">Event recipes run inside the platform; webhooks push events to external systems.</p>
        </div>
        <select value={workspaceId} onChange={(e) => setWorkspaceId(e.target.value)} className="bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
          {workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </div>

      {error && <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2"><AlertCircle className="h-4 w-4" /> {error}</div>}

      {newSecret && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="text-sm font-medium text-amber-800 mb-1">Webhook signing secret — shown only once</div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-white border border-amber-200 rounded px-2 py-1 flex-1 overflow-x-auto">{newSecret}</code>
            <button onClick={() => { navigator.clipboard?.writeText(newSecret); }} className="text-amber-700 hover:text-amber-900"><Copy className="h-4 w-4" /></button>
            <button onClick={() => setNewSecret(null)} className="text-amber-700 hover:text-amber-900"><X className="h-4 w-4" /></button>
          </div>
          <p className="text-xs text-amber-700 mt-2">Verify deliveries with HMAC-SHA256 of the raw body using this secret (header <code>X-QMS-Signature</code>).</p>
        </div>
      )}

      {/* Recipes */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-700">Automation recipes ({recipes.length})</h2>
          <button onClick={() => { setError(""); setShowRecipe(true); }} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md"><Plus className="h-3.5 w-3.5" /> New recipe</button>
        </div>
        {loading ? <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
          : recipes.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">No recipes. Example: when <b>invoice.overdue</b> then <b>create task</b>.</div>
          : recipes.map((r) => (
            <div key={r.id} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-900">{r.name}</span>
                <div className="text-xs text-gray-500 mt-0.5">when <code className="text-blue-700">{r.eventType}</code> then <b>{r.actionType.replace(/_/g, " ")}</b></div>
              </div>
              <button onClick={() => toggle("recipes", r.id, r.isActive)} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.isActive ? "active" : "paused"}</button>
              <button onClick={() => remove("recipes", r.id)} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
      </div>

      {/* Webhooks */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
          <Webhook className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-700">Outbound webhooks ({subs.length})</h2>
          <button onClick={() => { setError(""); setShowHook(true); }} className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md"><Plus className="h-3.5 w-3.5" /> New webhook</button>
        </div>
        {loading ? <div className="px-4 py-6 text-center text-sm text-gray-400">Loading…</div>
          : subs.length === 0 ? <div className="px-4 py-6 text-center text-sm text-gray-400">No webhooks yet. Push events to Slack relays, ERPs, BI pipelines…</div>
          : subs.map((s) => (
            <div key={s.id} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-900">{s.name}</span>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{s.url} · {Array.isArray(s.eventTypes) && s.eventTypes.length > 0 ? s.eventTypes.join(", ") : "all events"}</div>
                {s.failCount > 0 && <div className="text-[11px] text-red-600 mt-0.5">{s.failCount} consecutive failure(s){s.lastStatus ? ` · last status ${s.lastStatus}` : ""}</div>}
              </div>
              <button onClick={() => toggle("webhooks", s.id, s.isActive)} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{s.isActive ? "active" : "disabled"}</button>
              <button onClick={() => remove("webhooks", s.id)} className="text-gray-300 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
      </div>

      {/* New webhook modal */}
      {showHook && (
        <Modal title="New webhook" onClose={() => setShowHook(false)} onSave={createHook} saving={saving}>
          <Field label="Name *" value={hookForm.name} onChange={(v) => setHookForm({ ...hookForm, name: v })} placeholder="ERP sync" />
          <Field label="URL * (https)" value={hookForm.url} onChange={(v) => setHookForm({ ...hookForm, url: v })} placeholder="https://example.com/hooks/qms" />
          <Field label="Event filter (comma-separated, blank = all)" value={hookForm.eventTypes} onChange={(v) => setHookForm({ ...hookForm, eventTypes: v })} placeholder="invoice.paid, stock.low" />
        </Modal>
      )}

      {/* New recipe modal */}
      {showRecipe && (
        <Modal title="New automation recipe" onClose={() => setShowRecipe(false)} onSave={createRecipe} saving={saving}>
          <Field label="Name *" value={recipeForm.name} onChange={(v) => setRecipeForm({ ...recipeForm, name: v })} placeholder="Chase overdue invoices" />
          <label className="block">
            <span className="text-xs text-gray-500">When this happens</span>
            <input list="event-options" value={recipeForm.eventType} onChange={(e) => setRecipeForm({ ...recipeForm, eventType: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
            <datalist id="event-options">{COMMON_EVENTS.map((e) => <option key={e} value={e} />)}</datalist>
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Do this</span>
            <select value={recipeForm.actionType} onChange={(e) => setRecipeForm({ ...recipeForm, actionType: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
              <option value="notify_admins">Notify workspace admins</option>
              <option value="create_task">Create a board task</option>
            </select>
          </label>
          {recipeForm.actionType === "create_task" && (
            <>
              <label className="block">
                <span className="text-xs text-gray-500">Board *</span>
                <select value={recipeForm.boardId} onChange={(e) => setRecipeForm({ ...recipeForm, boardId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="">Select board…</option>
                  {boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </label>
              <Field label="Task title (use {event} for the event name)" value={recipeForm.titleTemplate} onChange={(v) => setRecipeForm({ ...recipeForm, titleTemplate: v })} placeholder="Follow up: {event}" />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose, onSave, saving }: { title: string; children: React.ReactNode; onClose: () => void; onSave: () => void; saving: boolean }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-lg w-full max-w-md p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">{children}</div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-gray-500">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
    </label>
  );
}
