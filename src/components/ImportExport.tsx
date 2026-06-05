"use client";

import { useRef, useState } from "react";
import { Download, Upload, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface ImportResult {
  total: number; created: number; updated: number; failed: number;
  errors: { row: number; message: string }[];
}

/**
 * Reusable Import/Export controls for a list page.
 * `entity` is the data-io registry slug; `workspaceId` scopes the data.
 * Set `canImport={false}` for export-only (transactional) entities.
 */
export default function ImportExport({
  entity, workspaceId, canImport = true, onImported,
}: { entity: string; workspaceId: string; canImport?: boolean; onImported?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");

  const exportCsv = async () => {
    if (!workspaceId) return;
    setBusy("export"); setError("");
    try {
      const res = await fetch(`/api/data-io/export?entity=${entity}&workspaceId=${workspaceId}`);
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Export failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${entity}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Export failed"); }
    finally { setBusy(null); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { e.target.value = ""; await importCsv(file); }
  };

  const importCsv = async (file: File) => {
    setBusy("import"); setError(""); setResult(null);
    try {
      const csv = await file.text();
      const res = await fetch("/api/data-io/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, workspaceId, csv }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
      onImported?.();
    } catch (e) { setError(e instanceof Error ? e.message : "Import failed"); }
    finally { setBusy(null); }
  };

  return (
    <div className="inline-flex items-center gap-2">
      {canImport && (
        <>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={!workspaceId || busy !== null}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium rounded-md"
          >
            {busy === "import" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Import
          </button>
        </>
      )}
      <button
        onClick={exportCsv}
        disabled={!workspaceId || busy !== null}
        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm font-medium rounded-md"
      >
        {busy === "export" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export
      </button>

      {error && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setError("")}>
          <div className="bg-white rounded-lg p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 text-red-600 mb-2"><AlertCircle className="h-5 w-5" /><span className="font-semibold">Error</span></div>
            <p className="text-sm text-gray-700">{error}</p>
            <div className="flex justify-end mt-4"><button onClick={() => setError("")} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md">OK</button></div>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setResult(null)}>
          <div className="bg-white rounded-lg p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-gray-900">
                <CheckCircle2 className="h-5 w-5 text-green-600" /><span className="font-semibold">Import complete</span>
              </div>
              <button onClick={() => setResult(null)} className="text-gray-400 hover:text-gray-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center mb-3">
              <Stat label="Created" value={result.created} color="text-green-600" />
              <Stat label="Updated" value={result.updated} color="text-blue-600" />
              <Stat label="Failed" value={result.failed} color="text-red-600" />
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-auto border border-gray-200 rounded-md text-sm">
                <table className="w-full">
                  <thead className="bg-gray-50 text-gray-500"><tr><th className="px-3 py-1.5 text-left font-medium w-16">Row</th><th className="px-3 py-1.5 text-left font-medium">Error</th></tr></thead>
                  <tbody>
                    {result.errors.map((er, i) => (
                      <tr key={i} className="border-t border-gray-100"><td className="px-3 py-1.5 text-gray-600">{er.row}</td><td className="px-3 py-1.5 text-red-600">{er.message}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end mt-4"><button onClick={() => setResult(null)} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md">Done</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-50 rounded-md py-2">
      <div className={`text-xl font-semibold ${color}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
