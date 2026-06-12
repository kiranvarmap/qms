"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Attach as Paperclip, Upload, Delete as Trash2, Doc as FileText } from "@vibe/icons";

interface Attachment {
  id: string;
  fileName: string;
  fileUrl: string | null;
  fileSize: number;
  contentType: string | null;
  createdAt: string;
}

/**
 * Drop-in attachments panel for any record (audit P9). Uploads through the
 * existing /api/upload, registers via /api/attachments with (refType, refId).
 */
export function AttachmentsSection({ workspaceId, refType, refId }: { workspaceId: string; refType: string; refId: string }) {
  const [rows, setRows] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!workspaceId || !refId) return;
    const res = await fetch(`/api/attachments?workspaceId=${workspaceId}&refType=${refType}&refId=${refId}`);
    const d = await res.json().catch(() => ({}));
    setRows(res.ok && Array.isArray(d.data) ? d.data : []);
  }, [workspaceId, refType, refId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const upload = async (file: File) => {
    setBusy(true); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const meta = await up.json().catch(() => ({}));
      if (!up.ok) { setError(meta.error || "Upload failed"); return; }
      const reg = await fetch("/api/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId, refType, refId,
          fileName: meta.name ?? file.name,
          fileKey: meta.key,
          fileUrl: meta.url,
          fileSize: meta.size ?? file.size,
          contentType: meta.type ?? file.type,
        }),
      });
      if (!reg.ok) { const e = await reg.json().catch(() => ({})); setError(e.error || "Could not attach file"); return; }
      load();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/attachments/${id}`, { method: "DELETE" });
    load();
  };

  const kb = (n: number) => (n >= 1_048_576 ? `${(n / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden mt-6">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-blue-600" />
        <h2 className="text-sm font-semibold text-gray-700">Attachments ({rows.length})</h2>
        <label className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium rounded-md cursor-pointer">
          <Upload className="h-3.5 w-3.5" /> {busy ? "Uploading…" : "Add file"}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
        </label>
      </div>
      {error && <div className="px-4 py-2 text-xs text-red-600 bg-red-50">{error}</div>}
      {rows.length === 0 ? (
        <div className="px-4 py-5 text-center text-sm text-gray-400">No files attached.</div>
      ) : rows.map((a) => (
        <div key={a.id} className="px-4 py-2.5 border-b border-gray-100 last:border-0 flex items-center gap-3">
          <FileText className="h-4 w-4 text-gray-400 shrink-0" />
          {a.fileUrl ? (
            <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-700 hover:underline truncate">{a.fileName}</a>
          ) : (
            <span className="text-sm text-gray-900 truncate">{a.fileName}</span>
          )}
          <span className="text-xs text-gray-400 shrink-0">{kb(a.fileSize)}</span>
          <button onClick={() => remove(a.id)} className="ml-auto text-gray-300 hover:text-red-600 shrink-0" title="Remove">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
