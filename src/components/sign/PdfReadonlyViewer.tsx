"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

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
  value: string | null;
  completedAt: string | null;
  label: string | null;
}

interface Recipient {
  id: string;
  name: string;
  color: string;
}

interface PdfReadonlyViewerProps {
  fileUrl: string;
  fields: Field[];
  recipients: Recipient[];
}

const FIELD_PREVIEW: Record<string, string> = {
  signature: "✍ Signature",
  initials: "Ini",
  date: "📅",
  text: "T",
  checkbox: "☐",
};

export default function PdfReadonlyViewer({ fileUrl, fields, recipients }: PdfReadonlyViewerProps) {
  const [numPages, setNumPages] = useState(0);

  const recipientMap = Object.fromEntries(recipients.map((r) => [r.id, r]));

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
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
          <div key={pageNum} className="relative shadow-md bg-white">
            <div className="absolute top-2 left-2 z-10 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
              Page {pageNum}
            </div>
            <div style={{ position: "relative" }}>
              <Page
                pageNumber={pageNum}
                width={640}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              {pageFields.map((field) => {
                const recipient = field.recipientId ? recipientMap[field.recipientId] : null;
                const color = recipient?.color || "#9CA3AF";
                const hasValue = field.value && field.completedAt;

                if (hasValue && field.type === "signature" && field.value?.startsWith("data:image")) {
                  return (
                    <div
                      key={field.id}
                      style={{
                        position: "absolute",
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={field.value}
                        alt="Signature"
                        style={{ width: "100%", height: "100%", objectFit: "contain" }}
                      />
                    </div>
                  );
                }

                return (
                  <div
                    key={field.id}
                    style={{
                      position: "absolute",
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      width: `${field.width}%`,
                      height: `${field.height}%`,
                      border: `2px solid ${hasValue ? color : `${color}60`}`,
                      backgroundColor: hasValue ? `${color}15` : `${color}08`,
                      borderRadius: "3px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "0 4px",
                      fontSize: "11px",
                      color: hasValue ? color : `${color}80`,
                      overflow: "hidden",
                    }}
                  >
                    {hasValue ? (
                      <span className="truncate font-medium">{field.value}</span>
                    ) : (
                      <span>{FIELD_PREVIEW[field.type] || "?"}</span>
                    )}
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
