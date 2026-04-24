"use client";

import { useState, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// Configure worker from public directory
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface Field {
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

interface Recipient {
  id: string;
  name: string;
  color: string;
}

interface PdfPrepareViewerProps {
  fileUrl: string;
  fields: Field[];
  recipients: Recipient[];
  activeTool: string | null;
  activeRecipientId: string | null;
  onPageCount: (n: number) => void;
  onAddField: (field: Omit<Field, "id">) => void;
  onRemoveField: (id: string) => void;
}

const FIELD_DEFAULTS: Record<string, { width: number; height: number; label: string }> = {
  signature: { width: 22, height: 7, label: "Signature" },
  initials: { width: 10, height: 6, label: "Initials" },
  date: { width: 16, height: 5, label: "Date" },
  text: { width: 22, height: 5, label: "Text" },
  checkbox: { width: 4, height: 4, label: "Checkbox" },
};

const FIELD_ICONS: Record<string, string> = {
  signature: "✍",
  initials: "Ini",
  date: "📅",
  text: "T",
  checkbox: "☐",
};

export default function PdfPrepareViewer({
  fileUrl,
  fields,
  recipients,
  activeTool,
  activeRecipientId,
  onPageCount,
  onAddField,
  onRemoveField,
}: PdfPrepareViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const recipientMap = Object.fromEntries(recipients.map((r) => [r.id, r]));

  const handlePageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, pageNum: number) => {
      if (!activeTool || !activeRecipientId) return;
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const relX = ((e.clientX - rect.left) / rect.width) * 100;
      const relY = ((e.clientY - rect.top) / rect.height) * 100;

      const defaults = FIELD_DEFAULTS[activeTool] || FIELD_DEFAULTS.text;

      // Center the field on click point, clamp to page
      const x = Math.min(Math.max(relX - defaults.width / 2, 0), 100 - defaults.width);
      const y = Math.min(Math.max(relY - defaults.height / 2, 0), 100 - defaults.height);

      onAddField({
        recipientId: activeRecipientId,
        type: activeTool,
        page: pageNum,
        x,
        y,
        width: defaults.width,
        height: defaults.height,
        label: defaults.label,
      });
    },
    [activeTool, activeRecipientId, onAddField]
  );

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages: n }) => {
        setNumPages(n);
        onPageCount(n);
      }}
      className="flex flex-col items-center gap-6"
      loading={
        <div className="flex items-center gap-2 text-gray-400 py-12">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Loading PDF…
        </div>
      }
      error={<div className="text-red-500 py-8 text-center">Failed to load PDF</div>}
    >
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
        const pageFields = fields.filter((f) => f.page === pageNum);
        return (
          <div key={pageNum} className="relative shadow-lg rounded-sm overflow-hidden bg-white">
            <div className="absolute top-2 left-2 z-10 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
              Page {pageNum}
            </div>
            {/* Page wrapper — click to place fields */}
            <div
              ref={(el) => { pageRefs.current[pageNum] = el; }}
              onClick={(e) => handlePageClick(e, pageNum)}
              className={activeTool ? "cursor-crosshair select-none" : "cursor-default"}
              style={{ position: "relative" }}
            >
              <Page
                pageNumber={pageNum}
                width={720}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />

              {/* Field overlays */}
              {pageFields.map((field) => {
                const recipient = field.recipientId ? recipientMap[field.recipientId] : null;
                const color = recipient?.color || "#6B7280";
                const icon = FIELD_ICONS[field.type] || "T";

                return (
                  <div
                    key={field.id}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${field.width}%`,
                      height: `${field.height}%`,
                      border: `2px solid ${color}`,
                      backgroundColor: `${color}20`,
                      borderRadius: "3px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "3px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: color,
                      cursor: "default",
                      userSelect: "none",
                    }}
                  >
                    <span>{icon}</span>
                    <span className="truncate">{recipient?.name?.split(" ")[0] || "?"}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveField(field.id);
                      }}
                      style={{
                        position: "absolute",
                        top: -8,
                        right: -8,
                        background: color,
                        color: "white",
                        border: "none",
                        borderRadius: "50%",
                        width: 16,
                        height: 16,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "10px",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </Document>
  );
}
