"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, X, Trash2, CheckCircle2, GitBranch } from "lucide-react";

interface Template { id: string; productId: string; version: string; name: string | null; status: string; workspaceId: string }
interface Material { id?: string; componentProductId?: string | null; description?: string | null; qtyPer: number; unit: string; criticalItem: boolean }
interface Stage { id: string; name: string; sequence: number; durationMinutes: number; setupMinutes: number; bufferMinutes: number; workCenterId: string | null; requiredSkillId: string | null; requiredHeadcount: number; qaCheckpointRequired: boolean; materials: Material[] }
interface WorkCenter { id: string; name: string }
interface Skill { id: string; name: string }
interface Product { id: string; name: string }

const emptyStage = { name: "", durationMinutes: "60", setupMinutes: "0", bufferMinutes: "0", workCenterId: "", requiredSkillId: "", requiredHeadcount: "1", qaCheckpointRequired: false };

export default function TemplateBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [template, setTemplate] = useState<Template | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const [workCenters, setWorkCenters] = useState<WorkCenter[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyStage);
  const [mats, setMats] = useState<Material[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const t = await fetch(`/api/process-templates/${id}`).then((r) => r.json());
    setTemplate(t?.template ?? null);
    setStages(t?.stages ?? []);
    if (t?.template?.workspaceId) {
      const ws = t.template.workspaceId;
      const [wc, sk, pr] = await Promise.all([
        fetch(`/api/work-centers?workspaceId=${ws}`).then((r) => r.json()),
        fetch(`/api/production-skills?workspaceId=${ws}`).then((r) => r.json()),
        fetch(`/api/products?workspaceId=${ws}`).then((r) => r.json()),
      ]);
      setWorkCenters(wc.data ?? []);
      setSkills(sk.data ?? []);
      setProducts(pr.data ?? []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const addStage = async () => {
    if (!form.name) return;
    setSaving(true);
    await fetch(`/api/process-templates/${id}/stages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      name: form.name, sequence: stages.length,
      durationMinutes: Number(form.durationMinutes) || 60, setupMinutes: Number(form.setupMinutes) || 0, bufferMinutes: Number(form.bufferMinutes) || 0,
      workCenterId: form.workCenterId || undefined, requiredSkillId: form.requiredSkillId || undefined,
      requiredHeadcount: Number(form.requiredHeadcount) || 1, qaCheckpointRequired: form.qaCheckpointRequired,
      materials: mats.map((m) => ({ componentProductId: m.componentProductId || undefined, description: m.description || undefined, qtyPer: Number(m.qtyPer) || 1, unit: m.unit || "unit", criticalItem: m.criticalItem })),
    }) });
    setSaving(false); setShowAdd(false); setForm(emptyStage); setMats([]); load();
  };

  const delStage = async (stageId: string) => {
    await fetch(`/api/process-templates/${id}/stages/${stageId}`, { method: "DELETE" });
    load();
  };

  const setStatus = async (status: string) => {
    await fetch(`/api/process-templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  };

  const wcName = (x: string | null) => workCenters.find((w) => w.id === x)?.name ?? "—";
  const skName = (x: string | null) => skills.find((s) => s.id === x)?.name ?? null;
  const productName = (x: string | null | undefined) => products.find((p) => p.id === x)?.name;

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!template) return <div className="p-8 text-gray-500">Template not found.</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <Link href="/dashboard/production-planning/templates" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4"><ArrowLeft className="h-4 w-4" /> Templates</Link>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{productName(template.productId) ?? "Product"} <span className="text-sm text-gray-400 font-mono">{template.version}</span></h1>
            <p className="text-xs text-gray-500 capitalize">Status: {template.status}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {template.status !== "active" && <button onClick={() => setStatus("active")} className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md"><CheckCircle2 className="h-4 w-4" /> Activate</button>}
          {template.status === "active" && <button onClick={() => setStatus("archived")} className="px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-sm font-medium rounded-md">Archive</button>}
          <button onClick={() => { setForm(emptyStage); setMats([]); setShowAdd(true); }} className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"><Plus className="h-4 w-4" /> Add Stage</button>
        </div>
      </div>

      {stages.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500">No stages yet. Add the first production stage.</div>
      ) : (
        <ol className="space-y-3">
          {stages.map((s, i) => (
            <li key={s.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">{s.name}{s.qaCheckpointRequired && <span className="ml-2 text-xs bg-purple-100 text-purple-700 rounded px-1.5 py-0.5">QA</span>}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {wcName(s.workCenterId)} · {s.durationMinutes}m{s.setupMinutes ? ` +${s.setupMinutes}m setup` : ""}{s.bufferMinutes ? ` +${s.bufferMinutes}m buffer` : ""}
                      {skName(s.requiredSkillId) ? ` · ${s.requiredHeadcount}× ${skName(s.requiredSkillId)}` : ""}
                    </p>
                    {s.materials.length > 0 && (
                      <p className="text-xs text-gray-400 mt-1">Materials: {s.materials.map((m) => `${productName(m.componentProductId) ?? m.description ?? "item"} ×${m.qtyPer}${m.criticalItem ? " ⚠" : ""}`).join(", ")}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => delStage(s.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowAdd(false)}>
          <div className="bg-white border border-gray-200 rounded-lg w-full max-w-lg p-6 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-gray-900">Add Stage</h2>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button></div>
            <div className="space-y-3">
              <label className="block"><span className="text-xs text-gray-500">Stage name *</span>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Welding" className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" /></label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block"><span className="text-xs text-gray-500">Duration (m)</span>
                  <input type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-2 py-2 text-sm text-gray-900" /></label>
                <label className="block"><span className="text-xs text-gray-500">Setup (m)</span>
                  <input type="number" value={form.setupMinutes} onChange={(e) => setForm({ ...form, setupMinutes: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-2 py-2 text-sm text-gray-900" /></label>
                <label className="block"><span className="text-xs text-gray-500">Buffer (m)</span>
                  <input type="number" value={form.bufferMinutes} onChange={(e) => setForm({ ...form, bufferMinutes: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-2 py-2 text-sm text-gray-900" /></label>
              </div>
              <label className="block"><span className="text-xs text-gray-500">Work center</span>
                <select value={form.workCenterId} onChange={(e) => setForm({ ...form, workCenterId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  <option value="">None</option>{workCenters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select></label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block"><span className="text-xs text-gray-500">Required skill</span>
                  <select value={form.requiredSkillId} onChange={(e) => setForm({ ...form, requiredSkillId: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                    <option value="">None</option>{skills.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></label>
                <label className="block"><span className="text-xs text-gray-500">Headcount</span>
                  <input type="number" value={form.requiredHeadcount} onChange={(e) => setForm({ ...form, requiredHeadcount: e.target.value })} className="mt-1 w-full bg-white border border-gray-300 rounded-md px-2 py-2 text-sm text-gray-900" /></label>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.qaCheckpointRequired} onChange={(e) => setForm({ ...form, qaCheckpointRequired: e.target.checked })} /> QA checkpoint required</label>

              <div className="border-t border-gray-100 pt-3">
                <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium text-gray-700">Stage materials</span>
                  <button onClick={() => setMats([...mats, { componentProductId: "", qtyPer: 1, unit: "unit", criticalItem: false }])} className="text-xs text-blue-600 hover:underline">+ Add material</button></div>
                {mats.map((m, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 mb-2 items-center">
                    <select value={m.componentProductId ?? ""} onChange={(e) => { const x = [...mats]; x[i] = { ...m, componentProductId: e.target.value }; setMats(x); }} className="col-span-6 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm">
                      <option value="">Component…</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input type="number" value={m.qtyPer} onChange={(e) => { const x = [...mats]; x[i] = { ...m, qtyPer: Number(e.target.value) }; setMats(x); }} className="col-span-2 bg-white border border-gray-300 rounded-md px-2 py-1.5 text-sm" />
                    <label className="col-span-3 flex items-center gap-1 text-xs text-gray-500"><input type="checkbox" checked={m.criticalItem} onChange={(e) => { const x = [...mats]; x[i] = { ...m, criticalItem: e.target.checked }; setMats(x); }} /> critical</label>
                    <button onClick={() => setMats(mats.filter((_, j) => j !== i))} className="col-span-1 text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
              <button onClick={addStage} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md">{saving ? "Saving…" : "Add Stage"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
