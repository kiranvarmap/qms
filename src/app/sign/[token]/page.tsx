"use client";
import { useToast } from "@/components/ui";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Locked as Shield, Completed as CheckCircle2, CloseRound as XCircle, Alert as AlertCircle, Signature as PenLine, Delete as Trash2 } from "@vibe/icons";
import SignaturePad from "signature_pad";

const PdfSignViewer = dynamic(() => import("@/components/sign/PdfSignViewer"), { ssr: false });

interface Field {
  id: string;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  label: string | null;
}

interface Recipient {
  id: string;
  name: string;
  email: string;
  color: string;
  status: string;
}

interface SignDocInfo {
  id: string;
  title: string;
  filePath: string;
  message: string | null;
  status: string;
  pageCount: number;
}

type PageState = "loading" | "ready" | "already_signed" | "error" | "submitted" | "declined";

export default function SignPage() {
  const params = useParams();
  const token = params.token as string;
  const { toast } = useToast();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [doc, setDoc] = useState<SignDocInfo | null>(null);
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Signature pad modal
  const [sigModal, setSigModal] = useState<{ fieldId: string; type: "signature" | "initials" } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);

  // Decline modal
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    fetch(`/api/sign/token/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          setErrorMsg(e.error || "Invalid or expired signing link");
          setPageState("error");
          return;
        }
        const data = await res.json();
        setDoc(data.document);
        setRecipient(data.recipient);
        setFields(data.fields);
        if (data.recipient?.status === "signed") {
          setPageState("already_signed");
        } else {
          setPageState("ready");
          // Pre-fill date fields
          const today = new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
          const preFilled: Record<string, string> = {};
          for (const f of data.fields) {
            if (f.type === "date") preFilled[f.id] = today;
          }
          if (Object.keys(preFilled).length > 0) setFieldValues(preFilled);
        }
      })
      .catch(() => {
        setErrorMsg("Failed to load document");
        setPageState("error");
      });
  }, [token]);

  // Init signature pad when modal opens
  useEffect(() => {
    if (!sigModal || !canvasRef.current) return;
    if (sigPadRef.current) sigPadRef.current.clear();
    sigPadRef.current = new SignaturePad(canvasRef.current, {
      backgroundColor: "rgba(255,255,255,0)",
      penColor: "#1d4ed8",
    });
    // Resize canvas to container
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);
    sigPadRef.current.clear();
  }, [sigModal]);

  const handleApplySignature = () => {
    if (!sigPadRef.current || !sigModal) return;
    if (sigPadRef.current.isEmpty()) {
      toast("Please draw your signature first", "warning");
      return;
    }
    const dataUrl = sigPadRef.current.toDataURL("image/png");
    setFieldValues((prev) => ({ ...prev, [sigModal.fieldId]: dataUrl }));
    setSigModal(null);
  };

  const handleFieldClick = useCallback(
    (field: Field) => {
      if (field.type === "signature" || field.type === "initials") {
        setSigModal({ fieldId: field.id, type: field.type });
      } else if (field.type === "checkbox") {
        setFieldValues((prev) => ({
          ...prev,
          [field.id]: prev[field.id] === "true" ? "" : "true",
        }));
      }
    },
    []
  );

  const handleTextChange = useCallback((fieldId: string, value: string) => {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  const requiredFields = fields.filter((f) => f.required);
  const filledRequired = requiredFields.filter((f) => !!fieldValues[f.id]?.trim());
  const canSubmit = filledRequired.length === requiredFields.length;
  const progress = requiredFields.length > 0
    ? Math.round((filledRequired.length / requiredFields.length) * 100)
    : 100;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sign/token/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldValues, action: "sign" }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setErrorMsg(e.error || "Failed to submit");
        return;
      }
      setPageState("submitted");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecline = async () => {
    setSubmitting(true);
    try {
      await fetch(`/api/sign/token/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline", declineReason }),
      });
      setPageState("declined");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Terminal states ────────────────────────────────────────────────────
  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-10 h-10 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">Loading document…</p>
        </div>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Unable to load document</h2>
          <p className="text-sm text-gray-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (pageState === "already_signed") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Already Signed</h2>
          <p className="text-sm text-gray-500">
            You have already signed &quot;{doc?.title}&quot;. Thank you!
          </p>
        </div>
      </div>
    );
  }

  if (pageState === "submitted") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
          <CheckCircle2 className="h-14 w-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Document Signed!</h2>
          <p className="text-gray-600 mb-1">Thank you, <strong>{recipient?.name}</strong>.</p>
          <p className="text-sm text-gray-400">
            You have successfully signed &quot;{doc?.title}&quot;.
            A confirmation will be sent to {recipient?.email}.
          </p>
        </div>
      </div>
    );
  }

  if (pageState === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm w-full text-center">
          <XCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-gray-800 mb-2">Signing Declined</h2>
          <p className="text-sm text-gray-500">
            You have declined to sign this document. The sender has been notified.
          </p>
        </div>
      </div>
    );
  }

  // ── Main signing UI ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-blue-600 flex-shrink-0" />
            <div>
              <h1 className="font-semibold text-gray-900 text-sm leading-tight">{doc?.title}</h1>
              <p className="text-xs text-gray-400">
                Signing as <strong>{recipient?.name}</strong> · {recipient?.email}
              </p>
            </div>
          </div>

          {/* Progress */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <div className="w-28 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span>{filledRequired.length}/{requiredFields.length} fields</span>
            </div>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Complete Signing
            </button>
            <button
              onClick={() => setShowDecline(true)}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-2"
            >
              Decline
            </button>
          </div>
        </div>
        {/* Message banner */}
        {doc?.message && (
          <div className="bg-blue-50 border-t border-blue-100 px-6 py-2 text-sm text-blue-800 text-center">
            {doc.message}
          </div>
        )}
      </header>

      {/* PDF viewer area */}
      <main className="flex-1 overflow-auto py-8 flex flex-col items-center">
        {fields.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p>No fields assigned to you in this document</p>
          </div>
        ) : (
          <PdfSignViewer
            fileUrl={doc?.filePath || ""}
            fields={fields}
            fieldValues={fieldValues}
            recipientColor={recipient?.color || "#3B82F6"}
            onFieldClick={handleFieldClick}
            onTextChange={handleTextChange}
          />
        )}
      </main>

      {/* Signature Pad Modal */}
      {sigModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <PenLine className="h-5 w-5 text-blue-600" />
                {sigModal.type === "signature" ? "Draw Your Signature" : "Draw Your Initials"}
              </h2>
              <button
                onClick={() => setSigModal(null)}
                className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              <p className="text-xs text-gray-500 mb-3">
                Draw in the box below using your mouse or finger
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-xl overflow-hidden bg-gray-50">
                <canvas
                  ref={canvasRef}
                  className="w-full"
                  style={{ height: 160, touchAction: "none" }}
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-2 text-center italic">
                — Sign above —
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => {
                  if (sigPadRef.current) sigPadRef.current.clear();
                }}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </button>
              <button
                onClick={handleApplySignature}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Apply {sigModal.type === "signature" ? "Signature" : "Initials"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decline Modal */}
      {showDecline && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Decline to Sign</h2>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">
                Are you sure you want to decline? The sender will be notified.
              </p>
              <textarea
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason for declining (optional)"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              />
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button
                onClick={() => setShowDecline(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDecline}
                disabled={submitting}
                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Decline to Sign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
