"use client";

import { useState, useRef } from "react";
import type { ColumnDef, CellValue, BoardMember, LabelConfig } from "@/lib/types";
import { Check, Star, ExternalLink, Upload, FileText, Trash2 } from "lucide-react";

interface CellRendererProps {
  column: ColumnDef;
  value: CellValue | undefined;
  members: BoardMember[];
  onChange: (value: Partial<CellValue>) => void;
  onAddOption?: (columnId: string, label: LabelConfig) => void;
}

export function CellRenderer({
  column,
  value,
  members,
  onChange,
  onAddOption,
}: CellRendererProps) {
  switch (column.type) {
    case "text":
      return <TextCell value={value?.textValue} onChange={(v) => onChange({ textValue: v })} />;
    case "number":
      return (
        <NumberCell
          value={value?.numberValue}
          onChange={(v) => onChange({ numberValue: v })}
        />
      );
    case "status":
      return (
        <StatusCell
          value={value?.jsonValue as { id: string; text: string; color: string } | null}
          labels={(column.config as { labels?: LabelConfig[] })?.labels || []}
          onChange={(v) => onChange({ jsonValue: v })}
          onAddOption={onAddOption ? (label) => onAddOption(column.id, label) : undefined}
        />
      );
    case "priority":
      return (
        <StatusCell
          value={value?.jsonValue as { id: string; text: string; color: string } | null}
          labels={(column.config as { labels?: LabelConfig[] })?.labels || []}
          onChange={(v) => onChange({ jsonValue: v })}
          onAddOption={onAddOption ? (label) => onAddOption(column.id, label) : undefined}
        />
      );
    case "date":
      return <DateCell value={value?.dateValue} onChange={(v) => onChange({ dateValue: v })} />;
    case "person":
      return (
        <PersonCell
          value={value?.jsonValue as { userId: string } | null}
          members={members}
          onChange={(v) => onChange({ jsonValue: v })}
        />
      );
    case "dropdown":
      return (
        <DropdownCell
          value={value?.jsonValue as { id: string; text: string } | null}
          labels={(column.config as { labels?: LabelConfig[] })?.labels || []}
          onChange={(v) => onChange({ jsonValue: v })}
          onAddOption={onAddOption ? (label) => onAddOption(column.id, label) : undefined}
        />
      );
    case "checkbox":
      return (
        <CheckboxCell
          value={value?.booleanValue ?? false}
          onChange={(v) => onChange({ booleanValue: v })}
        />
      );
    case "link":
      return (
        <LinkCell
          value={value?.textValue}
          onChange={(v) => onChange({ textValue: v })}
        />
      );
    case "rating":
      return (
        <RatingCell
          value={value?.numberValue ?? 0}
          onChange={(v) => onChange({ numberValue: v })}
        />
      );
    case "file":
      return (
        <FileCell
          value={value?.jsonValue as { url: string; name: string; size: number; type: string } | null}
          onChange={(v) => onChange({ jsonValue: v })}
        />
      );
    default:
      return <TextCell value={value?.textValue} onChange={(v) => onChange({ textValue: v })} />;
  }
}

// ── Text Cell ──────────────────────────────────────────────────────
function TextCell({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || "");

  const commit = () => {
    if (text !== (value || "")) onChange(text);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className="w-full h-full text-xs px-2 py-1 border border-blue-400 rounded outline-none bg-white"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
      />
    );
  }

  return (
    <button
      className="w-full text-xs text-gray-700 text-left px-2 py-1 rounded hover:bg-gray-100 truncate min-h-[28px]"
      onClick={() => {
        setText(value || "");
        setEditing(true);
      }}
    >
      {value || <span className="text-gray-300">—</span>}
    </button>
  );
}

// ── Number Cell ────────────────────────────────────────────────────
function NumberCell({
  value,
  onChange,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value?.toString() || "");

  const commit = () => {
    const num = parseFloat(text);
    onChange(isNaN(num) ? null : num);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        type="number"
        className="w-full text-xs px-2 py-1 border border-blue-400 rounded outline-none bg-white text-right"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
      />
    );
  }

  return (
    <button
      className="w-full text-xs text-gray-700 text-right px-2 py-1 rounded hover:bg-gray-100 min-h-[28px]"
      onClick={() => {
        setText(value?.toString() || "");
        setEditing(true);
      }}
    >
      {value != null ? value : <span className="text-gray-300">—</span>}
    </button>
  );
}

const OPTION_COLORS = ["#579bfc", "#00c875", "#fdab3d", "#e2445c", "#a25ddc", "#037f4c", "#ff642e", "#cab641"];

// ── Status / Priority Cell (label picker) ──────────────────────────
function StatusCell({
  value,
  labels,
  onChange,
  onAddOption,
}: {
  value: { id: string; text: string; color: string } | null;
  labels: LabelConfig[];
  onChange: (v: { id: string; text: string; color: string } | null) => void;
  onAddOption?: (label: LabelConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const [addingNew, setAddingNew] = useState(false);

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        className="w-full text-xs font-medium px-2 py-1 rounded text-center min-h-[28px] transition-colors"
        style={
          value
            ? { backgroundColor: value.color, color: "#fff" }
            : { backgroundColor: "#f3f4f6", color: "#9ca3af" }
        }
        onClick={handleOpen}
      >
        {value?.text || "—"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[70] w-40 rounded-md bg-white shadow-lg ring-1 ring-gray-200 py-1"
            style={{ top: pos.top, left: pos.left }}
          >
            {labels.map((label) => (
              <button
                key={label.id}
                className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                onClick={() => {
                  onChange({ id: label.id, text: label.text, color: label.color });
                  setOpen(false);
                }}
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                {label.text}
                {value?.id === label.id && (
                  <Check className="h-3 w-3 ml-auto text-blue-600" />
                )}
              </button>
            ))}
            {value && (
              <>
                <hr className="my-1" />
                <button
                  className="w-full px-2 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Clear
                </button>
              </>
            )}
            {onAddOption && (
              <>
                <hr className="my-1" />
                {addingNew ? (
                  <div className="px-2 py-1">
                    <input
                      className="w-full text-xs border rounded px-1.5 py-1 outline-none focus:border-blue-400"
                      placeholder="Option name"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          const text = e.currentTarget.value.trim();
                          const id = String(Date.now());
                          const color = OPTION_COLORS[labels.length % OPTION_COLORS.length];
                          onAddOption({ id, text, color });
                          onChange({ id, text, color });
                          setAddingNew(false);
                          setOpen(false);
                        }
                        if (e.key === "Escape") setAddingNew(false);
                      }}
                      onBlur={() => setAddingNew(false)}
                    />
                  </div>
                ) : (
                  <button
                    className="w-full px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-gray-50 flex items-center gap-1"
                    onClick={() => setAddingNew(true)}
                  >
                    + New label
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Date Cell ──────────────────────────────────────────────────────
function DateCell({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dateStr = value ? new Date(value).toISOString().split("T")[0] : "";

  return (
    <div className="relative">
      <button
        className="w-full text-xs text-gray-700 px-2 py-1 rounded hover:bg-gray-100 text-center min-h-[28px]"
        onClick={() => inputRef.current?.showPicker?.()}
      >
        {dateStr
          ? new Date(dateStr).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : <span className="text-gray-300">—</span>}
      </button>
      <input
        ref={inputRef}
        type="date"
        className="absolute inset-0 opacity-0 cursor-pointer"
        value={dateStr}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  );
}

// ── Person Cell ────────────────────────────────────────────────────
function PersonCell({
  value,
  members,
  onChange,
}: {
  value: { userId: string } | null;
  members: BoardMember[];
  onChange: (v: { userId: string; name: string } | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = value
    ? members.find((m) => m.userId === value.userId)
    : null;

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        className="w-full text-xs px-2 py-1 rounded hover:bg-gray-100 text-center min-h-[28px] flex items-center justify-center gap-1"
        onClick={handleOpen}
      >
        {selected ? (
          <>
            <span
              className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-medium flex-shrink-0"
            >
              {(selected.name || selected.email).charAt(0).toUpperCase()}
            </span>
            <span className="truncate">
              {selected.name || selected.email.split("@")[0]}
            </span>
          </>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[70] w-48 rounded-md bg-white shadow-lg ring-1 ring-gray-200 py-1 max-h-48 overflow-y-auto"
            style={{ top: pos.top, left: pos.left }}
          >
            {members.map((m) => (
              <button
                key={m.userId}
                className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                onClick={() => {
                  onChange({ userId: m.userId, name: m.name || m.email });
                  setOpen(false);
                }}
              >
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] font-medium flex-shrink-0">
                  {(m.name || m.email).charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{m.name || m.email}</span>
                {value?.userId === m.userId && (
                  <Check className="h-3 w-3 ml-auto text-blue-600" />
                )}
              </button>
            ))}
            {value && (
              <>
                <hr className="my-1" />
                <button
                  className="w-full px-2 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50"
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Dropdown Cell ──────────────────────────────────────────────────
function DropdownCell({
  value,
  labels,
  onChange,
  onAddOption,
}: {
  value: { id: string; text: string } | null;
  labels: LabelConfig[];
  onChange: (v: { id: string; text: string } | null) => void;
  onAddOption?: (label: LabelConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const [addingNew, setAddingNew] = useState(false);

  const handleOpen = () => {
    if (open) { setOpen(false); return; }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen(true);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        className="w-full text-xs px-2 py-1 rounded hover:bg-gray-100 text-center min-h-[28px] text-gray-700"
        onClick={handleOpen}
      >
        {value?.text || <span className="text-gray-300">\u2014</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[70] w-40 rounded-md bg-white shadow-lg ring-1 ring-gray-200 py-1 max-h-48 overflow-y-auto"
            style={{ top: pos.top, left: pos.left }}
          >
            {labels.map((label) => (
              <button
                key={label.id}
                className="w-full px-2 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                onClick={() => {
                  onChange({ id: label.id, text: label.text });
                  setOpen(false);
                }}
              >
                {label.text}
                {value?.id === label.id && (
                  <Check className="h-3 w-3 ml-auto text-blue-600" />
                )}
              </button>
            ))}
            {value && (
              <button
                className="w-full px-2 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50 border-t"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                Clear
              </button>
            )}
            {onAddOption && (
              <>
                <hr className="my-1" />
                {addingNew ? (
                  <div className="px-2 py-1">
                    <input
                      className="w-full text-xs border rounded px-1.5 py-1 outline-none focus:border-blue-400"
                      placeholder="Option name"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.currentTarget.value.trim()) {
                          const text = e.currentTarget.value.trim();
                          const id = String(Date.now());
                          const color = OPTION_COLORS[labels.length % OPTION_COLORS.length];
                          onAddOption({ id, text, color });
                          onChange({ id, text });
                          setAddingNew(false);
                          setOpen(false);
                        }
                        if (e.key === "Escape") setAddingNew(false);
                      }}
                      onBlur={() => setAddingNew(false)}
                    />
                  </div>
                ) : (
                  <button
                    className="w-full px-2 py-1.5 text-left text-xs text-blue-600 hover:bg-gray-50 flex items-center gap-1"
                    onClick={() => setAddingNew(true)}
                  >
                    + New option
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Checkbox Cell ──────────────────────────────────────────────────
function CheckboxCell({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[28px]">
      <button
        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          value
            ? "bg-blue-600 border-blue-600 text-white"
            : "border-gray-300 hover:border-blue-400"
        }`}
        onClick={() => onChange(!value)}
      >
        {value && <Check className="h-3 w-3" />}
      </button>
    </div>
  );
}

// ── Link Cell ──────────────────────────────────────────────────────
function LinkCell({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value || "");

  const commit = () => {
    if (text !== (value || "")) onChange(text);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className="w-full text-xs px-2 py-1 border border-blue-400 rounded outline-none bg-white"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="https://..."
        autoFocus
      />
    );
  }

  return (
    <div className="flex items-center gap-1 min-h-[28px]">
      <button
        className="flex-1 text-xs text-blue-600 text-left px-2 py-1 rounded hover:bg-gray-100 truncate"
        onClick={() => {
          setText(value || "");
          setEditing(true);
        }}
      >
        {value ? (
          <span className="underline">{value.replace(/^https?:\/\//, "").slice(0, 30)}</span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </button>
      {value && (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-0.5 hover:bg-gray-100 rounded"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 text-gray-400" />
        </a>
      )}
    </div>
  );
}

// ── Rating Cell ────────────────────────────────────────────────────
function RatingCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex items-center justify-center gap-0.5 min-h-[28px]">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          className="p-0"
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(star === value ? 0 : star)}
        >
          <Star
            className={`h-3.5 w-3.5 transition-colors ${
              star <= (hover || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── File Cell ──────────────────────────────────────────────────────
function FileCell({
  value,
  onChange,
}: {
  value: { url: string; name: string; size: number; type: string } | null;
  onChange: (v: { url: string; name: string; size: number; type: string } | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) {
        const data = await res.json();
        onChange(data);
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (value) {
    const isImage = value.type?.startsWith("image/");
    return (
      <div className="flex items-center gap-1 min-h-[28px] group/file px-1">
        {isImage ? (
          <a href={value.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.url} alt={value.name} className="w-5 h-5 rounded object-cover flex-shrink-0" />
            <span className="text-[11px] text-gray-600 truncate">{value.name}</span>
          </a>
        ) : (
          <a href={value.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 flex-1 min-w-0">
            <FileText className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-[11px] text-blue-600 truncate hover:underline">{value.name}</span>
          </a>
        )}
        <button
          className="p-0.5 rounded hover:bg-red-50 opacity-0 group-hover/file:opacity-100 transition-opacity flex-shrink-0"
          onClick={(e) => { e.stopPropagation(); onChange(null); }}
          title="Remove file"
        >
          <Trash2 className="h-3 w-3 text-gray-300 hover:text-red-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[28px]">
      <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} />
      <button
        className="text-[11px] text-gray-400 hover:text-gray-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? (
          <span className="animate-pulse">Uploading…</span>
        ) : (
          <>
            <Upload className="h-3 w-3" />
            <span>Upload</span>
          </>
        )}
      </button>
    </div>
  );
}
