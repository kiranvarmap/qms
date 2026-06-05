"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Plus,
  Trash2,
  UserPlus,
  PenLine,
  Type,
  Calendar,
  CheckSquare,
  Fingerprint,
  AlertCircle,
  ChevronRight,
} from "lucide-react";

const PdfPrepareViewer = dynamic(
  () => import("@/components/sign/PdfPrepareViewer"),
  { ssr: false }
);

interface Recipient {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  order: number;
  status: string;
}

interface FieldDraft {
  id: string;
  recipientId: string | null;
  type: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string | null;
}

interface SignDocInfo {
  id: string;
  title: string;
  filePath: string;
  status: string;
  pageCount: number;
  message: string | null;
}

const FIELD_TOOLS = [
  { type: "signature", label: "Signature", icon: PenLine, description: "Full signature" },
  { type: "initials", label: "Initials", icon: Fingerprint, description: "Initials only" },
  { type: "date", label: "Date", icon: Calendar, description: "Date signed" },
  { type: "text", label: "Text", icon: Type, description: "Text input" },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare, description: "Checkbox" },
];

const RECIPIENT_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316",
];

export default function PreparePage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [doc, setDoc] = useState<SignDocInfo | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [activeRecipientId, setActiveRecipientId] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  // New recipient form
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("signer");

  const loadDoc = useCallback(async () => {
    const res = await fetch(`/api/sign/documents/${docId}`);
    if (!res.ok) { router.push("/dashboard/sign"); return; }
    const data = await res.json();
    setDoc(data);
    setRecipients(data.recipients || []);
    setFields(data.fields || []);
    if (data.recipients?.length > 0) {
      setActiveRecipientId(data.recipients[0].id);
    }
  }, [docId, router]);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  // When pageCount is known, save it to DB
  useEffect(() => {
    if (pageCount > 0 && doc && doc.pageCount !== pageCount) {
      fetch(`/api/sign/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageCount }),
      }).catch(() => {});
    }
  }, [pageCount, doc, docId]);

  const handleAddRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) return;

    const colorIndex = recipients.length % RECIPIENT_COLORS.length;
    const res = await fetch("/api/sign/recipients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        documentId: docId,
        name: newName.trim(),
        email: newEmail.trim(),
        role: newRole,
        color: RECIPIENT_COLORS[colorIndex],
      }),
    });

    if (!res.ok) { alert("Failed to add recipient"); return; }
    const recipient = await res.json();
    setRecipients((prev) => [...prev, recipient]);
    setActiveRecipientId(recipient.id);
    setNewName("");
    setNewEmail("");
    setNewRole("signer");
    setShowAddRecipient(false);
  };

  const handleRemoveRecipient = async (id: string) => {
    await fetch(`/api/sign/recipients/${id}`, { method: "DELETE" });
    setRecipients((prev) => prev.filter((r) => r.id !== id));
    setFields((prev) => prev.filter((f) => f.recipientId !== id));
    if (activeRecipientId === id) {
      const remaining = recipients.filter((r) => r.id !== id);
      setActiveRecipientId(remaining[0]?.id ?? null);
    }
  };

  const handleAddField = useCallback(
    async (field: Omit<FieldDraft, "id">) => {
      // Optimistic add with temp ID
      const tempId = `temp_${Date.now()}`;
      const tempField: FieldDraft = { ...field, id: tempId };
      setFields((prev) => [...prev, tempField]);

      const res = await fetch("/api/sign/fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: docId, ...field }),
      });

      if (res.ok) {
        const saved = await res.json();
        setFields((prev) => prev.map((f) => (f.id === tempId ? saved : f)));
      } else {
        setFields((prev) => prev.filter((f) => f.id !== tempId));
      }
    },
    [docId]
  );

  const handleRemoveField = useCallback(async (id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (!id.startsWith("temp_")) {
      await fetch(`/api/sign/fields/${id}`, { method: "DELETE" });
    }
  }, []);

  const handleSend = async () => {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`/api/sign/documents/${docId}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setSendError(data.error || "Failed to send"); return; }
      router.push(`/dashboard/sign/${docId}/view`);
    } finally {
      setSending(false);
    }
  };

  const signers = recipients.filter((r) => r.role === "signer");
  const canSend =
    signers.length > 0 &&
    signers.every((s) => fields.some((f) => f.recipientId === s.id));

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <Link
            href="/dashboard/sign"
            className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-600 mb-2"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Documents
          </Link>
          <h1 className="font-semibold text-gray-900 truncate text-sm">{doc.title}</h1>
          <p className="text-xs text-gray-600 mt-0.5">
            {doc.status === "draft" ? "Click the PDF to place fields" : "View only — document sent"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Recipients */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Recipients
              </span>
              {doc.status === "draft" && (
                <button
                  onClick={() => setShowAddRecipient(true)}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              )}
            </div>

            <div className="space-y-2">
              {recipients.length === 0 ? (
                <div className="text-center py-4 text-xs text-gray-600 border border-dashed border-gray-200 rounded-lg">
                  <UserPlus className="h-5 w-5 mx-auto mb-1 opacity-50" />
                  Add recipients to get started
                </div>
              ) : (
                recipients.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => { setActiveRecipientId(r.id); }}
                    className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-colors ${
                      activeRecipientId === r.id
                        ? "border-blue-200 bg-blue-50"
                        : "border-transparent hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-gray-900 text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: r.color }}
                    >
                      {r.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{r.name}</p>
                      <p className="text-[10px] text-gray-600 truncate">{r.email}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-gray-600">
                        {fields.filter((f) => f.recipientId === r.id).length} fields
                      </span>
                      {doc.status === "draft" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveRecipient(r.id);
                          }}
                          className="p-0.5 text-gray-700 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Recipient Form */}
            {showAddRecipient && doc.status === "draft" && (
              <form
                onSubmit={handleAddRecipient}
                className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2"
              >
                <p className="text-xs font-medium text-gray-700">Add Recipient</p>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Full name"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                  autoFocus
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="signer">Signer</option>
                  <option value="viewer">Viewer (CC only)</option>
                </select>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddRecipient(false)}
                    className="flex-1 text-xs py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 text-xs py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Field Tools (only in draft mode) */}
          {doc.status === "draft" && activeRecipientId && (
            <div className="p-4 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Field Type
              </div>
              <div className="space-y-1">
                {FIELD_TOOLS.map((tool) => {
                  const Icon = tool.icon;
                  const isActive = activeTool === tool.type;
                  return (
                    <button
                      key={tool.type}
                      onClick={() => setActiveTool(isActive ? null : tool.type)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <div className="text-left">
                        <div className="text-xs font-semibold">{tool.label}</div>
                        <div className={`text-[10px] ${isActive ? "text-blue-200" : "text-gray-600"}`}>
                          {tool.description}
                        </div>
                      </div>
                      {isActive && <ChevronRight className="h-3 w-3 ml-auto" />}
                    </button>
                  );
                })}
              </div>

              {activeTool && (
                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                  Click anywhere on the PDF to place a{" "}
                  <strong>
                    {FIELD_TOOLS.find((t) => t.type === activeTool)?.label}
                  </strong>{" "}
                  field for{" "}
                  <strong>
                    {recipients.find((r) => r.id === activeRecipientId)?.name}
                  </strong>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          <div className="p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              How to prepare
            </div>
            <ol className="space-y-1.5 text-xs text-gray-500 list-decimal list-inside">
              <li>Add each person who needs to sign</li>
              <li>Select a recipient, then pick a field type</li>
              <li>Click on the PDF to place the field</li>
              <li>Repeat for each signer</li>
              <li>Click &quot;Send for Signatures&quot;</li>
            </ol>
          </div>
        </div>

        {/* Footer — Send Button */}
        <div className="p-4 border-t border-gray-200 bg-white">
          {sendError && (
            <p className="text-xs text-red-600 mb-2 flex items-start gap-1">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              {sendError}
            </p>
          )}
          {doc.status === "draft" ? (
            <button
              onClick={handleSend}
              disabled={sending || !canSend}
              title={!canSend ? "Add recipients and place at least one field per signer" : ""}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <div className="w-4 h-4 border-2 border-gray-200 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send for Signatures
            </button>
          ) : (
            <Link
              href={`/dashboard/sign/${docId}/view`}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              View Document Status
            </Link>
          )}
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto p-8 flex flex-col items-center">
        {doc && (
          <PdfPrepareViewer
            fileUrl={doc.filePath}
            fields={fields}
            recipients={recipients}
            activeTool={doc.status === "draft" ? activeTool : null}
            activeRecipientId={activeRecipientId}
            onPageCount={setPageCount}
            onAddField={handleAddField}
            onRemoveField={handleRemoveField}
          />
        )}
      </div>
    </div>
  );
}
