"use client";

import { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

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

interface PdfSignViewerProps {
  fileUrl: string;
  fields: Field[];
  fieldValues: Record<string, string>;
  recipientColor: string;
  onFieldClick: (field: Field) => void;
  onTextChange: (fieldId: string, value: string) => void;
}

export default function PdfSignViewer({
  fileUrl,
  fields,
  fieldValues,
  recipientColor,
  onFieldClick,
  onTextChange,
}: PdfSignViewerProps) {
  const [numPages, setNumPages] = useState(0);

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages: n }) => setNumPages(n)}
      className="flex flex-col items-center gap-8"
      loading={
        <div className="flex items-center gap-2 text-gray-400 py-16">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          Loading PDF…
        </div>
      }
      error={<div className="text-red-500 py-8 text-center">Failed to load PDF</div>}
    >
      {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => {
        const pageFields = fields.filter((f) => f.page === pageNum);
        return (
          <div key={pageNum} className="relative shadow-xl rounded-sm">
            <div className="absolute top-2 left-2 z-10 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full pointer-events-none">
              Page {pageNum}
            </div>
            <div style={{ position: "relative" }}>
              <Page
                pageNumber={pageNum}
                width={700}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
              {pageFields.map((field) => {
                const value = fieldValues[field.id];
                const isFilled = !!value?.trim();
                const isRequired = field.required;

                // Signature/Initials fields
                if (field.type === "signature" || field.type === "initials") {
                  return (
                    <div
                      key={field.id}
                      onClick={() => onFieldClick(field)}
                      style={{
                        position: "absolute",
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                        border: `2px solid ${isFilled ? recipientColor : isRequired ? "#EF4444" : "#9CA3AF"}`,
                        backgroundColor: isFilled ? "transparent" : `${recipientColor}15`,
                        borderRadius: "4px",
                        cursor: "pointer",
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isFilled && value.startsWith("data:image") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={value}
                          alt={field.type}
                          style={{ width: "100%", height: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <div
                          style={{
                            color: isRequired ? "#EF4444" : "#9CA3AF",
                            fontSize: "11px",
                            fontWeight: 600,
                            textAlign: "center",
                            padding: "2px 4px",
                          }}
                        >
                          {field.type === "signature" ? "✍ Click to Sign" : "Click for Initials"}
                          {isRequired && <span style={{ color: "#EF4444" }}> *</span>}
                        </div>
                      )}
                    </div>
                  );
                }

                // Date / Text fields
                if (field.type === "date" || field.type === "text") {
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
                      <input
                        type={field.type === "date" ? "text" : "text"}
                        value={value || ""}
                        onChange={(e) => onTextChange(field.id, e.target.value)}
                        placeholder={
                          field.type === "date"
                            ? "Date"
                            : field.label || "Enter text"
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          border: `2px solid ${isFilled ? recipientColor : isRequired ? "#EF4444" : "#D1D5DB"}`,
                          borderRadius: "3px",
                          backgroundColor: isFilled ? `${recipientColor}10` : "white",
                          padding: "0 6px",
                          fontSize: "11px",
                          outline: "none",
                          color: "#111",
                          fontFamily: "inherit",
                          cursor: "text",
                        }}
                      />
                    </div>
                  );
                }

                // Checkbox
                if (field.type === "checkbox") {
                  const checked = value === "true";
                  return (
                    <div
                      key={field.id}
                      onClick={() => onFieldClick(field)}
                      style={{
                        position: "absolute",
                        left: `${field.x}%`,
                        top: `${field.y}%`,
                        width: `${field.width}%`,
                        height: `${field.height}%`,
                        border: `2px solid ${checked ? recipientColor : isRequired ? "#EF4444" : "#9CA3AF"}`,
                        backgroundColor: checked ? `${recipientColor}20` : "white",
                        borderRadius: "3px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        color: recipientColor,
                        fontWeight: "bold",
                      }}
                    >
                      {checked ? "✓" : ""}
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        );
      })}
    </Document>
  );
}
