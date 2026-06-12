"use client";
import { useConfirm, useToast } from "@/components/ui";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Doc as FileText, Upload, Add as Plus, Search, Time as Clock, Completed as CheckCircle2, CloseRound as XCircle, Alert as AlertCircle, Show as Eye, Settings, Delete as Trash2, Send } from "@vibe/icons";

type DocStatus = "draft" | "pending" | "completed" | "voided" | "declined";

interface SignDoc {
  id: string;
  title: string;
  fileName: string;
  status: DocStatus;
  recipientCount: number;
  createdAt: string;
  completedAt: string | null;
  dueDate: string | null;
}

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600", icon: FileText },
  pending: { label: "Pending", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  voided: { label: "Voided", color: "bg-red-100 text-red-600", icon: XCircle },
  declined: { label: "Declined", color: "bg-red-100 text-red-600", icon: AlertCircle },
};

const TABS: { id: "all" | DocStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "pending", label: "Pending" },
  { id: "completed", label: "Completed" },
  { id: "voided", label: "Voided" },
];

export default function SignDocumentsPage() {
  const confirmAction = useConfirm();
  const { toast } = useToast();
  const [docs, setDocs] = useState<SignDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | DocStatus>("all");
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = tab !== "all" ? `?status=${tab}` : "";
      const res = await fetch(`/api/sign/documents${params}`);
      setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", uploadTitle.trim());
      fd.append("message", uploadMessage.trim());
      const res = await fetch("/api/sign/documents", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        toast(err.error || "Upload failed", "warning");
        return;
      }
      const doc = await res.json();
      setShowUpload(false);
      setUploadFile(null);
      setUploadTitle("");
      setUploadMessage("");
      // Navigate to prepare page
      window.location.href = `/dashboard/sign/${doc.id}/prepare`;
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!(await confirmAction(`Delete "${title}"? This cannot be undone.`))) return;
    await fetch(`/api/sign/documents/${id}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleVoid = async (id: string) => {
    if (!(await confirmAction("Void this document? All pending signatures will be cancelled."))) return;
    await fetch(`/api/sign/documents/${id}/void`, { method: "POST" });
    load();
  };

  const filtered = docs.filter((d) =>
    d.title.toLowerCase().includes(search.toLowerCase()) ||
    d.fileName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-gray-900 [font-family:var(--font-display)] flex items-center gap-2">
            <FileText className="h-7 w-7 text-blue-600" />
            Document Signing
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Upload PDFs and collect e-signatures
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                tab === t.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-600" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search documents…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
        </div>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="flex justify-center py-16 text-gray-600 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-600">
          <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No documents found</p>
          <p className="text-sm mt-1">Upload a PDF to get started</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Document</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipients</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((doc) => {
                const cfg = STATUS_CONFIG[doc.status];
                const Icon = cfg.icon;
                return (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4 w-4 text-red-500" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{doc.title}</p>
                          <p className="text-xs text-gray-600">{doc.fileName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
                        <Icon className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {doc.recipientCount} {doc.recipientCount === 1 ? "recipient" : "recipients"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {doc.completedAt
                        ? `Completed ${new Date(doc.completedAt).toLocaleDateString()}`
                        : new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {doc.status === "draft" && (
                          <Link
                            href={`/dashboard/sign/${doc.id}/prepare`}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <Settings className="h-3.5 w-3.5" />
                            Prepare
                          </Link>
                        )}
                        {doc.status !== "draft" && (
                          <Link
                            href={`/dashboard/sign/${doc.id}/view`}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Link>
                        )}
                        {doc.status === "pending" && (
                          <button
                            onClick={() => handleVoid(doc.id)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Void
                          </button>
                        )}
                        {(doc.status === "draft" || doc.status === "voided" || doc.status === "declined") && (
                          <button
                            onClick={() => handleDelete(doc.id, doc.title)}
                            className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-600" />
                Upload Document
              </h2>
              <button
                onClick={() => setShowUpload(false)}
                className="text-gray-600 hover:text-gray-600 text-xl font-light"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  uploadFile ? "border-blue-400 bg-blue-50" : "border-gray-300 hover:border-blue-400"
                }`}
                onClick={() => document.getElementById("pdf-file-input")?.click()}
              >
                <input
                  id="pdf-file-input"
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadFile(f);
                      if (!uploadTitle) setUploadTitle(f.name.replace(".pdf", ""));
                    }
                  }}
                />
                {uploadFile ? (
                  <div>
                    <FileText className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <p className="font-medium text-blue-700">{uploadFile.name}</p>
                    <p className="text-xs text-blue-500">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 font-medium">Click to upload PDF</p>
                    <p className="text-xs text-gray-600 mt-1">Maximum 20MB</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Document Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Service Agreement"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message to signers (optional)
                </label>
                <textarea
                  value={uploadMessage}
                  onChange={(e) => setUploadMessage(e.target.value)}
                  rows={2}
                  placeholder="Please review and sign this document…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(false)}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile || !uploadTitle.trim()}
                  className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-200 border-t-transparent rounded-full animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Upload & Prepare
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
