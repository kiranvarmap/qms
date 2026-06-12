"use client";

import { NativeSelect } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Add as Plus, Delete as Trash2, Subitems as Layers, Workflow as GitBranch, Subitems as ListTree } from "@vibe/icons";

interface Product { id: string; name: string; sku: string | null; category: string | null; unit: string; lifecycleStatus?: string; currentRevision?: string | null; }
interface BomLine { id: string; description: string | null; quantity: number; unit: string; scrapPct: number; }
interface Bom { id: string; version: string; name: string | null; status: string; lines: BomLine[]; }
interface Revision { id: string; revision: string; changeSummary: string | null; status: string; releasedAt: string | null; }
interface Spec { id: string; key: string; value: string | null; unit: string | null; }

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [boms, setBoms] = useState<Bom[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [specs, setSpecs] = useState<Spec[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, e] = await Promise.all([
      fetch(`/api/products/${id}`).then((r) => r.json()),
      fetch(`/api/products/${id}/engineering`).then((r) => r.json()),
    ]);
    setProduct(p && p.id ? p : null);
    setBoms(Array.isArray(e.boms) ? e.boms : []);
    setRevisions(Array.isArray(e.revisions) ? e.revisions : []);
    setSpecs(Array.isArray(e.specs) ? e.specs : []);
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const setLifecycle = async (lifecycleStatus: string) => {
    await fetch(`/api/products/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lifecycleStatus }) });
    load();
  };

  if (loading) return <div className="p-8 text-gray-500">Loading…</div>;
  if (!product) return <div className="p-8 text-gray-500">Product not found. <Link href="/dashboard/products" className="text-blue-600 hover:underline">Back</Link></div>;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <Link href="/dashboard/products" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /> Products</Link>

      <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-gray-900 [font-family:var(--font-display)]">{product.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {product.sku ? <span className="font-mono">{product.sku}</span> : "No SKU"} · {product.category || "Uncategorized"} · per {product.unit}
              {product.currentRevision ? <> · Rev <span className="font-medium text-gray-700">{product.currentRevision}</span></> : null}
            </p>
          </div>
          <label className="text-sm">
            <span className="text-xs text-gray-500 block mb-1">Lifecycle</span>
            <NativeSelect value={product.lifecycleStatus || "active"} onChange={(e) => setLifecycle(e.target.value)} className="bg-white border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900">
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="obsolete">Obsolete</option>
            </NativeSelect>
          </label>
        </div>
      </div>

      <Specifications productId={id} specs={specs} reload={load} />
      <Boms productId={id} boms={boms} reload={load} />
      <Revisions productId={id} revisions={revisions} reload={load} />
    </div>
  );
}

function Section({ icon, title, action, children }: { icon: React.ReactNode; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2 text-gray-900 font-medium">{icon}{title}</div>
        {action}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Specifications({ productId, specs, reload }: { productId: string; specs: Spec[]; reload: () => void }) {
  const [key, setKey] = useState(""); const [value, setValue] = useState(""); const [unit, setUnit] = useState("");
  const add = async () => {
    if (!key.trim()) return;
    await fetch(`/api/products/${productId}/specs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: key.trim(), value: value.trim() || undefined, unit: unit.trim() || undefined }) });
    setKey(""); setValue(""); setUnit(""); reload();
  };
  const del = async (specId: string) => { await fetch(`/api/products/${productId}/specs?specId=${specId}`, { method: "DELETE" }); reload(); };
  return (
    <Section icon={<ListTree className="h-4 w-4 text-blue-600" />} title="Specifications">
      {specs.length === 0 ? <p className="text-sm text-gray-500 mb-4">No specifications yet.</p> : (
        <div className="mb-4 divide-y divide-gray-100">
          {specs.map((s) => (
            <div key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-900"><span className="text-gray-500">{s.key}:</span> {s.value || "—"} {s.unit || ""}</span>
              <button onClick={() => del(s.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="Key (e.g. Material)" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" className="w-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
        <button onClick={add} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md inline-flex items-center gap-1"><Plus className="h-4 w-4" /> Add</button>
      </div>
    </Section>
  );
}

function Boms({ productId, boms, reload }: { productId: string; boms: Bom[]; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("v1");
  const [lines, setLines] = useState<{ description: string; quantity: string; unit: string }[]>([{ description: "", quantity: "1", unit: "unit" }]);
  const save = async () => {
    const payloadLines = lines.filter((l) => l.description.trim()).map((l) => ({ description: l.description.trim(), quantity: Number(l.quantity) || 1, unit: l.unit.trim() || "unit" }));
    await fetch(`/api/products/${productId}/bom`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: version.trim() || "v1", status: "draft", lines: payloadLines }) });
    setOpen(false); setVersion("v1"); setLines([{ description: "", quantity: "1", unit: "unit" }]); reload();
  };
  return (
    <Section
      icon={<Layers className="h-4 w-4 text-blue-600" />}
      title="Bill of Materials"
      action={<button onClick={() => setOpen(!open)} className="text-sm text-blue-600 hover:underline">{open ? "Cancel" : "Add BOM"}</button>}
    >
      {open && (
        <div className="mb-5 border border-gray-200 rounded-md p-4 bg-gray-50 space-y-3">
          <input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="Version" className="w-40 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
          {lines.map((l, i) => (
            <div key={i} className="flex gap-2">
              <input value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} placeholder="Component" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
              <input value={l.quantity} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, quantity: e.target.value } : x))} type="number" placeholder="Qty" className="w-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
              <input value={l.unit} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} placeholder="Unit" className="w-24 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
            </div>
          ))}
          <div className="flex justify-between">
            <button onClick={() => setLines([...lines, { description: "", quantity: "1", unit: "unit" }])} className="text-sm text-gray-600 hover:text-gray-900">+ line</button>
            <button onClick={save} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md">Save BOM</button>
          </div>
        </div>
      )}
      {boms.length === 0 ? <p className="text-sm text-gray-500">No BOMs yet.</p> : (
        <div className="space-y-4">
          {boms.map((b) => (
            <div key={b.id} className="border border-gray-200 rounded-md">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200 text-sm">
                <span className="font-medium text-gray-900">{b.version}{b.name ? ` — ${b.name}` : ""}</span>
                <span className="text-xs rounded-full bg-gray-100 text-gray-700 px-2 py-0.5">{b.status}</span>
              </div>
              {b.lines.length === 0 ? <p className="text-sm text-gray-500 px-4 py-3">No components.</p> : (
                <table className="w-full text-sm">
                  <tbody>
                    {b.lines.map((l) => (
                      <tr key={l.id} className="border-b border-gray-100 last:border-0">
                        <td className="px-4 py-2 text-gray-900">{l.description}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{l.quantity} {l.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function Revisions({ productId, revisions, reload }: { productId: string; revisions: Revision[]; reload: () => void }) {
  const [open, setOpen] = useState(false);
  const [revision, setRevision] = useState(""); const [summary, setSummary] = useState(""); const [release, setRelease] = useState(false);
  const save = async () => {
    if (!revision.trim()) return;
    await fetch(`/api/products/${productId}/revisions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: revision.trim(), changeSummary: summary.trim() || undefined, release }) });
    setOpen(false); setRevision(""); setSummary(""); setRelease(false); reload();
  };
  return (
    <Section
      icon={<GitBranch className="h-4 w-4 text-blue-600" />}
      title="Revisions"
      action={<button onClick={() => setOpen(!open)} className="text-sm text-blue-600 hover:underline">{open ? "Cancel" : "Add Revision"}</button>}
    >
      {open && (
        <div className="mb-5 border border-gray-200 rounded-md p-4 bg-gray-50 space-y-3">
          <div className="flex gap-2">
            <input value={revision} onChange={(e) => setRevision(e.target.value)} placeholder="Revision (e.g. A)" className="w-40 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
            <input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Change summary" className="flex-1 bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900" />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={release} onChange={(e) => setRelease(e.target.checked)} /> Release immediately</label>
            <button onClick={save} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md">Save Revision</button>
          </div>
        </div>
      )}
      {revisions.length === 0 ? <p className="text-sm text-gray-500">No revisions yet.</p> : (
        <div className="divide-y divide-gray-100">
          {revisions.map((r) => (
            <div key={r.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-900"><span className="font-medium">Rev {r.revision}</span> {r.changeSummary ? <span className="text-gray-500">— {r.changeSummary}</span> : null}</span>
              <span className={`text-xs rounded-full px-2 py-0.5 ${r.status === "released" ? "bg-green-100 text-green-700" : r.status === "superseded" ? "bg-gray-100 text-gray-600" : "bg-amber-100 text-amber-700"}`}>{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}
