"use client";

import { useState, useRef, useCallback } from "react";
import { Add as Plus, Text as Type, Numbers as Hash, Status as CircleDot, Calendar, Person as User, NavigationChevronDown as ChevronDown, Checkbox as CheckSquare, Link, Favorite as Star, Warning as AlertTriangle } from "@vibe/icons";

const COLUMN_TYPES = [
  { type: "text", label: "Text", icon: Type, description: "Single line text" },
  { type: "number", label: "Numbers", icon: Hash, description: "Numeric values" },
  { type: "status", label: "Status", icon: CircleDot, description: "Status labels with colors" },
  { type: "date", label: "Date", icon: Calendar, description: "Date picker" },
  { type: "person", label: "Person", icon: User, description: "Assign team members" },
  { type: "dropdown", label: "Dropdown", icon: ChevronDown, description: "List of options" },
  { type: "checkbox", label: "Checkbox", icon: CheckSquare, description: "True / false" },
  { type: "link", label: "Link", icon: Link, description: "URL" },
  { type: "priority", label: "Priority", icon: AlertTriangle, description: "Priority labels" },
  { type: "rating", label: "Rating", icon: Star, description: "1–5 star rating" },
] as const;

interface AddColumnMenuProps {
  onAdd: (name: string, type: string) => void;
}

export function AddColumnMenu({ onAdd }: AddColumnMenuProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"type" | "name">("type");
  const [selectedType, setSelectedType] = useState<string>("");
  const [name, setName] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const reset = useCallback(() => {
    setOpen(false);
    setStep("type");
    setSelectedType("");
    setName("");
  }, []);

  const handleOpen = () => {
    if (open) { reset(); return; }
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: Math.min(rect.right - 264, window.innerWidth - 280) });
    }
    setOpen(true);
  };

  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    const match = COLUMN_TYPES.find((t) => t.type === type);
    setName(match?.label || "");
    setStep("name");
  };

  const handleAdd = () => {
    if (name.trim()) {
      onAdd(name.trim(), selectedType);
      reset();
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        className="flex items-center justify-center w-8 h-8 rounded hover:bg-gray-200 text-gray-600"
        onClick={handleOpen}
        title="Add column"
      >
        <Plus className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={reset} />
          <div
            className="fixed z-[70] w-64 rounded-lg bg-white shadow-xl ring-1 ring-gray-200 overflow-hidden"
            style={{ top: pos.top, left: pos.left }}
          >
            {step === "type" ? (
              <div>
                <div className="px-3 py-2 border-b bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Choose column type
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {COLUMN_TYPES.map((ct) => {
                    const Icon = ct.icon;
                    return (
                      <button
                        key={ct.type}
                        className="w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center gap-3 group"
                        onClick={() => handleTypeSelect(ct.type)}
                      >
                        <div className="w-7 h-7 rounded bg-gray-100 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-4 w-4 text-gray-500 group-hover:text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-700 group-hover:text-blue-700">
                            {ct.label}
                          </div>
                          <div className="text-xs text-gray-600">
                            {ct.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3">
                <label className="text-xs font-medium text-gray-500 block mb-1">
                  Column name
                </label>
                <input
                  className="w-full text-sm px-3 py-2 border rounded-md outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAdd();
                    if (e.key === "Escape") reset();
                  }}
                  autoFocus
                  placeholder="Column name..."
                />
                <div className="flex items-center justify-between mt-3 gap-2">
                  <button
                    className="text-xs text-gray-500 hover:text-gray-700"
                    onClick={() => setStep("type")}
                  >
                    ← Back
                  </button>
                  <button
                    className="px-4 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                    onClick={handleAdd}
                    disabled={!name.trim()}
                  >
                    Add Column
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
