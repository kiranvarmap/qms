"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MoveArrowLeft as ArrowLeft, Doc as FileText, Completed as CheckCircle2, Time as Clock, CloseRound as XCircle, Show as Eye, Download, Alert as AlertCircle, Person as User, Calendar } from "@vibe/icons";

const PdfReadonlyViewer = dynamic(() => import("@/components/sign/PdfReadonlyViewer"), { ssr: false });

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  color: string;
  signedAt: string | null;
}

interface Field {
  id: string;
  recipientId: string | null;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | null;
  completedAt: string | null;
  label: string | null;
}

interface AuditEvent {
  id: string;
  eventType: string;
  description: string | null;
  ipAddress: string | null;
  recipientId: string | null;
  createdAt: string;
}

interface DocDetail {
  id: string;
  title: string;
  fileName: string;
  filePath: string;
  status: string;
  message: string | null;
  pageCount: number;
  completedAt: string | null;
  completedFilePath: string | null;
  createdAt: string;
  creatorName: string | null;
  recipients: Recipient[];
  fields: Field[];
  events: AuditEvent[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600", icon: FileText },
  pending: { label: "Pending Signatures", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  voided: { label: "Voided", color: "bg-red-100 text-red-600", icon: XCircle },
  declined: { label: "Declined", color: "bg-red-100 text-red-600", icon: AlertCircle },
};

const RECIPIENT_STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "Not yet viewed", color: "text-gray-500", icon: Clock },
  viewed: { label: "Viewed, not signed", color: "text-yellow-600", icon: Eye },
  signed: { label: "Signed", color: "text-green-600", icon: CheckCircle2 },
  declined: { label: "Declined", color: "text-red-600", icon: XCircle },
};

const EVENT_ICONS: Record<string, string> = {
  document_created: "📄",
  document_sent: "📤",
  document_viewed: "👁️",
  recipient_signed: "✍️",
  document_completed: "✅",
  document_voided: "🚫",
  document_declined: "❌",
};

export default function ViewDocPage() {
  const params = useParams();
  const docId = params.id as string;
  const [doc, setDoc] = useState<DocDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sign/documents/${docId}`);
      if (!res.ok) return;
      setDoc(await res.json());
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-600">
        <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-8 text-center text-gray-600">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Document not found</p>
        <Link href="/dashboard/sign" className="text-blue-600 text-sm mt-2 inline-block">← Back</Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[doc.status] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/dashboard/sign" className="mt-1 text-gray-600 hover:text-gray-600 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-[24px] font-semibold tracking-tight text-gray-900 [font-family:var(--font-display)]">{doc.title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.color}`}>
              <StatusIcon className="h-3 w-3" />
              {statusCfg.label}
            </span>
            <span className="text-xs text-gray-600">
              Created {new Date(doc.createdAt).toLocaleDateString()}{doc.creatorName ? ` by ${doc.creatorName}` : ""}
            </span>
            {doc.completedAt && (
              <span className="text-xs text-green-600">
                Completed {new Date(doc.completedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={doc.filePath}
            download={doc.fileName}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Original PDF
          </a>
          {doc.completedFilePath && (
            <a
              href={doc.completedFilePath}
              download={`signed_${doc.fileName}`}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Signed PDF
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Recipients + Audit */}
        <div className="col-span-1 space-y-4">
          {/* Recipients */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-gray-600" />
              Recipients
            </h2>
            {doc.recipients.length === 0 ? (
              <p className="text-xs text-gray-600">No recipients added</p>
            ) : (
              <div className="space-y-2">
                {doc.recipients.map((r) => {
                  const rCfg = RECIPIENT_STATUS[r.status] || RECIPIENT_STATUS.pending;
                  const RIcon = rCfg.icon;
                  return (
                    <div key={r.id} className="flex items-center gap-2.5 py-1.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-900 text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: r.color }}
                      >
                        {r.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                        <p className="text-xs text-gray-600 truncate">{r.email}</p>
                        <div className={`flex items-center gap-1 mt-0.5 text-xs ${rCfg.color}`}>
                          <RIcon className="h-3 w-3" />
                          {rCfg.label}
                          {r.signedAt && (
                            <span className="text-gray-600">
                              · {new Date(r.signedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Message */}
          {doc.message && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <h2 className="text-xs font-semibold text-blue-700 mb-1">Message to signers</h2>
              <p className="text-sm text-blue-800">{doc.message}</p>
            </div>
          )}

          {/* Audit Trail */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-600" />
              Audit Trail
            </h2>
            {doc.events.length === 0 ? (
              <p className="text-xs text-gray-600">No events yet</p>
            ) : (
              <div className="space-y-3">
                {doc.events.map((ev) => (
                  <div key={ev.id} className="flex gap-2.5">
                    <div className="text-base flex-shrink-0 mt-0.5">
                      {EVENT_ICONS[ev.eventType] || "·"}
                    </div>
                    <div>
                      <p className="text-xs text-gray-700">{ev.description}</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">
                        {new Date(ev.createdAt).toLocaleString()}
                        {ev.ipAddress && ` · ${ev.ipAddress}`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: PDF Viewer */}
        <div className="col-span-2 bg-gray-200 rounded-xl overflow-auto p-4 flex flex-col items-center gap-4 min-h-[600px]">
          <PdfReadonlyViewer
            fileUrl={doc.filePath}
            fields={doc.fields}
            recipients={doc.recipients}
          />
        </div>
      </div>
    </div>
  );
}
