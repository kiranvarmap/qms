"use client";

import { useState } from "react";
import { Add as Plus, Delete as Trash2, CloseSmall as X } from "@vibe/icons";
import type { LabelConfig, ColumnDef } from "@/lib/types";

const PRESET_COLORS = [
  "#e2445c", "#fdab3d", "#00c875", "#0086c0", "#579bfc",
  "#a25ddc", "#037f4c", "#333333", "#c4c4c4", "#ff642e",
  "#cab641", "#9cd326", "#ff7575", "#bb3354", "#5559df",
  "#401694",
];

interface EditOptionsModalProps {
  column: ColumnDef;
  onSave: (columnId: string, labels: LabelConfig[]) => void;
  onClose: () => void;
}

export function EditOptionsModal({ column, onSave, onClose }: EditOptionsModalProps) {
  const existingLabels = (column.config as { labels?: LabelConfig[] })?.labels || [];
  const [labels, setLabels] = useState<LabelConfig[]>(
    existingLabels.map((l) => ({ ...l }))
  );
  const [editingColorId, setEditingColorId] = useState<string | null>(null);

  const addLabel = () => {
    const id = String(Date.now());
    const usedColors = new Set(labels.map((l) => l.color));
    const nextColor = PRESET_COLORS.find((c) => !usedColors.has(c)) || PRESET_COLORS[0];
    setLabels([...labels, { id, text: "", color: nextColor }]);
  };

  const updateLabel = (id: string, updates: Partial<LabelConfig>) => {
    setLabels(labels.map((l) => (l.id === id ? { ...l, ...updates } : l)));
  };

  const deleteLabel = (id: string) => {
    setLabels(labels.filter((l) => l.id !== id));
  };

  const handleSave = () => {
    // Filter out empty labels
    const cleaned = labels.filter((l) => l.text.trim());
    onSave(column.id, cleaned);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Edit {column.type === "dropdown" ? "Dropdown" : column.type === "status" ? "Status" : "Priority"} Options
              </h3>
              <p className="text-[11px] text-gray-600 mt-0.5">
                Column: {column.name}
              </p>
            </div>
            <button
              className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
              onClick={onClose}
            >
              <X className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Labels list */}
          <div className="px-5 py-3 max-h-[400px] overflow-y-auto space-y-2">
            {labels.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-6">
                No options yet. Click &quot;Add option&quot; to create one.
              </p>
            )}
            {labels.map((label) => (
              <div key={label.id} className="flex items-center gap-2 group">
                {/* Color picker */}
                <div className="relative">
                  <button
                    className="w-7 h-7 rounded-md flex-shrink-0 border border-gray-200 hover:ring-2 hover:ring-gray-300 transition-all"
                    style={{ backgroundColor: label.color }}
                    onClick={() => setEditingColorId(editingColorId === label.id ? null : label.id)}
                    title="Change color"
                  />
                  {editingColorId === label.id && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setEditingColorId(null)} />
                      <div className="absolute left-0 top-full z-20 mt-1 p-2 bg-white rounded-lg shadow-xl ring-1 ring-gray-200 w-[180px]">
                        <div className="grid grid-cols-8 gap-1">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              className={`w-5 h-5 rounded-sm transition-all ${
                                label.color === c
                                  ? "ring-2 ring-offset-1 ring-gray-500 scale-110"
                                  : "hover:scale-110"
                              }`}
                              style={{ backgroundColor: c }}
                              onClick={() => {
                                updateLabel(label.id, { color: c });
                                setEditingColorId(null);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Text input */}
                <input
                  className="flex-1 text-[13px] px-2.5 py-1.5 border border-gray-200 rounded-md outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 bg-white"
                  value={label.text}
                  onChange={(e) => updateLabel(label.id, { text: e.target.value })}
                  placeholder="Option name…"
                />

                {/* Delete */}
                <button
                  className="p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => deleteLabel(label.id)}
                  title="Remove option"
                >
                  <Trash2 className="h-3.5 w-3.5 text-gray-700 hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>

          {/* Add + Footer */}
          <div className="border-t px-5 py-3 flex items-center justify-between">
            <button
              className="text-[13px] text-blue-600 hover:text-blue-700 flex items-center gap-1.5 font-medium"
              onClick={addLabel}
            >
              <Plus className="h-3.5 w-3.5" />
              Add option
            </button>
            <div className="flex gap-2">
              <button
                className="px-3 py-1.5 text-[13px] text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="px-4 py-1.5 text-[13px] font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                onClick={handleSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
