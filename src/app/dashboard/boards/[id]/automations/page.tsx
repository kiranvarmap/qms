"use client";

import { NativeSelect, useConfirm } from "@/components/ui";
import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface AutomationLog {
  id: string;
  itemId: string | null;
  triggeredAt: string;
  status: string; // "success" | "error"
  details: Record<string, unknown>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
import { MoveArrowLeft as ArrowLeft, Add as Plus, Delete as Trash2, Bolt as Zap, Email as Mail, Notifications as Bell, MoveArrowRight as MoveRight, Switch as ToggleLeft, Switch as ToggleRight, NavigationChevronDown as ChevronDown, NavigationChevronRight as ChevronRight, Calendar, Description as AlignLeft, Numbers as Hash, Tags as Tag, Retry as RefreshCw, Doc as FileText, Robot as Bot, Completed as CheckCircle2, Radio as Circle, Person as User, Settings } from "@vibe/icons";
import { Loader as Loader2 } from "@vibe/core";
import { cn } from "@/lib/utils";

interface Automation {
  id: string; name: string; isActive: boolean;
  triggerType: string; triggerConfig: Record<string, unknown>;
  actionType: string; actionConfig: Record<string, unknown>;
  createdAt: string;
}
interface LabelOption { id: string; text: string; color?: string; }
interface Column { id: string; name: string; type: string; config?: { labels?: LabelOption[] }; }
interface Member { userId: string; name: string | null; email: string; }

// A single "set column → value" row
interface FieldChange { columnId: string; value: string; }
// One rule: "when source column = [whenValue]" → apply these changes
interface ValueRule { whenValue: string; fieldChanges: FieldChange[]; }

const TRIGGER_TYPES = [
  { value: "item_created",   label: "Item is created",       icon: Plus,        color: "bg-violet-100 text-violet-700", dot: "bg-violet-500"  },
  { value: "column_changed", label: "A column changes",      icon: RefreshCw,   color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500"    },
  { value: "status_changed", label: "Status changes to…",    icon: Tag,         color: "bg-amber-100 text-amber-700",  dot: "bg-amber-500"   },
  { value: "date_reached",   label: "A date arrives",        icon: Calendar,    color: "bg-rose-100 text-rose-700",    dot: "bg-rose-500"    },
  { value: "form_submitted", label: "Form is submitted",     icon: FileText,    color: "bg-teal-100 text-teal-700",    dot: "bg-teal-500"    },
];

const ACTION_TYPES = [
  { value: "notify_user",  label: "Notify a person",     icon: Bell,     color: "bg-blue-100 text-blue-700",    dot: "bg-blue-500"    },
  { value: "send_email",   label: "Send an email",        icon: Mail,     color: "bg-indigo-100 text-indigo-700",dot: "bg-indigo-500"  },
  { value: "change_field", label: "Set a field value",    icon: Hash,     color: "bg-orange-100 text-orange-700",dot: "bg-orange-500"  },
  { value: "move_to_group",label: "Move to a group",      icon: MoveRight,color: "bg-green-100 text-green-700",  dot: "bg-green-500"   },
  { value: "set_date",     label: "Set a date column",    icon: Calendar, color: "bg-rose-100 text-rose-700",    dot: "bg-rose-500"    },
  { value: "archive_item", label: "Archive the item",     icon: AlignLeft,color: "bg-gray-100 text-gray-700",   dot: "bg-gray-500"    },
];

function getTrigger(v: string) { return TRIGGER_TYPES.find(t => t.value === v) ?? TRIGGER_TYPES[0]; }
function getAction(v: string)  { return ACTION_TYPES.find(a => a.value === v)  ?? ACTION_TYPES[0]; }

const inputCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition";
const selectCls = "w-full";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5";

interface StepProps { auto: Partial<Automation>; columns: Column[]; members: Member[]; onChange: (u: Partial<Automation>) => void; }

function TriggerStep({ auto, columns, onChange }: StepProps) {
  const trigger = getTrigger(auto.triggerType ?? "item_created");
  const Icon = trigger.icon;
  return (
    <div className="space-y-3">
      <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold", trigger.color)}>
        <Icon className="h-3.5 w-3.5" />
        TRIGGER
      </div>
      <div>
        <label className={labelCls}>When this happens…</label>
        <NativeSelect value={auto.triggerType ?? "item_created"} onChange={e => onChange({ triggerType: e.target.value, triggerConfig: {} })} className={selectCls}>
          {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </NativeSelect>
      </div>
      {auto.triggerType === "column_changed" && (() => {
        const triggerCol = columns.find(c => c.id === (auto.triggerConfig?.columnId as string));
        const toValue = (auto.triggerConfig?.toValue as string) ?? "";
        const labels = triggerCol?.config?.labels ?? [];
        return (
          <>
            <div>
              <label className={labelCls}>Which column?</label>
              <NativeSelect
 value={(auto.triggerConfig?.columnId as string) ?? ""}
 onChange={e => onChange({ triggerConfig: { columnId: e.target.value } })}
                className={selectCls}>
                <option value="">Select column…</option>
                {columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </div>
            {triggerCol && (
              <div>
                <label className={labelCls}>Changes to</label>
                {labels.length > 0 ? (
                  <NativeSelect
 value={toValue}
 onChange={e => onChange({ triggerConfig: { ...auto.triggerConfig, toValue: e.target.value } })}
                    className={selectCls}>
                    <option value="">Any value (all changes)</option>
                    {labels.map(l => (
                      <option key={l.id} value={l.text}>{l.text}</option>
                    ))}
                  </NativeSelect>
                ) : (
                  <input
                    value={toValue}
                    onChange={e => onChange({ triggerConfig: { ...auto.triggerConfig, toValue: e.target.value } })}
                    className={inputCls}
                    placeholder="Specific value, or leave blank for any change…"
                  />
                )}
                {toValue && (
                  <p className="text-[11px] text-blue-600 mt-1">
                    Fires only when <strong>{triggerCol.name}</strong> changes to <strong>&quot;{toValue}&quot;</strong>.
                  </p>
                )}
              </div>
            )}
          </>
        );
      })()}
      {auto.triggerType === "status_changed" && (
        <div>
          <label className={labelCls}>To which status?</label>
          <input value={(auto.triggerConfig?.toValue as string) ?? ""} onChange={e => onChange({ triggerConfig: { ...auto.triggerConfig, toValue: e.target.value } })} className={inputCls} placeholder="e.g. Done, In Progress…" />
        </div>
      )}
      {auto.triggerType === "date_reached" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Days before</label>
            <input type="number" min={0} value={(auto.triggerConfig?.offsetDays as number) ?? 0} onChange={e => onChange({ triggerConfig: { ...auto.triggerConfig, offsetDays: Number(e.target.value) } })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Date column</label>
            <NativeSelect value={(auto.triggerConfig?.columnId as string) ?? ""} onChange={e => onChange({ triggerConfig: { ...auto.triggerConfig, columnId: e.target.value } })} className={selectCls}>
              <option value="">Select column</option>
              {columns.filter(c => c.type === "date").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </div>
        </div>
      )}
    </div>
  );
}

// ── FlatFieldChangesEditor ───────────────────────────────────────────────────
// Simple flat list of "Set column → value" rows used when the trigger already
// specifies a concrete value (e.g. "when Priority changes to Low").
function FlatFieldChangesEditor({ triggerCol, toValue, columns, fieldChanges, onChange }: {
  triggerCol: Column;
  toValue: string;
  columns: Column[];
  fieldChanges: FieldChange[];
  onChange: (changes: FieldChange[]) => void;
}) {
  const matchedLabel = triggerCol.config?.labels?.find(l => l.text === toValue);

  const addRow = () => onChange([...fieldChanges, { columnId: "", value: "" }]);
  const updateRow = (idx: number, patch: Partial<FieldChange>) =>
    onChange(fieldChanges.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const removeRow = (idx: number) => onChange(fieldChanges.filter((_, i) => i !== idx));

  return (
    <div className="space-y-3">
      {/* Context banner */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
        <RefreshCw className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
        <span className="text-[11px] text-blue-700">
          When <strong>{triggerCol.name}</strong> changes to{" "}
          <span className="inline-flex items-center gap-1">
            {matchedLabel?.color && (
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: matchedLabel.color }} />
            )}
            <strong>&quot;{toValue}&quot;</strong>
          </span>
          , apply these changes:
        </span>
      </div>

      {/* Field change rows */}
      {fieldChanges.length === 0 ? (
        <div className="flex flex-col items-center py-5 border-2 border-dashed border-gray-200 rounded-xl gap-1">
          <Hash className="h-5 w-5 text-gray-900" />
          <p className="text-xs text-gray-600">No field changes yet.</p>
          <button type="button" onClick={addRow}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 mt-0.5">
            + Add first change
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {fieldChanges.map((row, idx) => {
            const targetCol = columns.find(c => c.id === row.columnId);
            return (
              <div key={idx} className="flex items-end gap-2 group/row">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1">Set column</label>
                    <NativeSelect
 value={row.columnId}
 onChange={e => updateRow(idx, { columnId: e.target.value, value: "" })}
                      className={selectCls}>
                      <option value="">Select column…</option>
                      {columns.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                      ))}
                    </NativeSelect>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1">To value</label>
                    {targetCol ? (
                      <FieldValueInput col={targetCol} value={row.value} onChange={v => updateRow(idx, { value: v })} />
                    ) : (
                      <input disabled className={inputCls + " opacity-40"} placeholder="Select a column first" />
                    )}
                  </div>
                </div>
                <button type="button" onClick={() => removeRow(idx)}
                  className="p-1.5 rounded text-gray-900 hover:text-red-500 hover:bg-red-50 flex-shrink-0 mb-px opacity-0 group-hover/row:opacity-100 transition-all">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <button type="button" onClick={addRow}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors pt-1">
            <Plus className="h-3 w-3" />Add field change
          </button>
        </div>
      )}
    </div>
  );
}

// ── FieldValueInput ───────────────────────────────────────────────────────────
// Renders a list of (column → value) rows for the "change_field" action.
// Each column type gets its own appropriate value input.
function FieldValueInput({ col, value, onChange }: { col: Column; value: string; onChange: (v: string) => void }) {
  const labels = col.config?.labels ?? [];

  if ((col.type === "status" || col.type === "priority") && labels.length > 0) {
    return (
      <div className="relative flex-1">
        <NativeSelect value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
          <option value="">Select value…</option>
          {labels.map(l => (
            <option key={l.id} value={l.text}>{l.text}</option>
          ))}
        </NativeSelect>
        {/* Color swatch for selected label */}
        {value && labels.find(l => l.text === value)?.color && (
          <span
            className="absolute right-8 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none"
            style={{ backgroundColor: labels.find(l => l.text === value)?.color }}
          />
        )}
      </div>
    );
  }

  if (col.type === "boolean") {
    return (
      <NativeSelect value={value} onChange={e => onChange(e.target.value)} className={selectCls + " flex-1"}>
        <option value="">Select…</option>
        <option value="true">True ✓</option>
        <option value="false">False ✗</option>
      </NativeSelect>
    );
  }

  if (col.type === "number") {
    return (
      <input type="number" value={value} onChange={e => onChange(e.target.value)}
        className={inputCls + " flex-1"} placeholder="Enter number…" />
    );
  }

  if (col.type === "date") {
    return (
      <NativeSelect value={value} onChange={e => onChange(e.target.value)} className={selectCls + " flex-1"}>
        <option value="">Select…</option>
        <option value="today">Today</option>
        <option value="+1">Tomorrow (+1 day)</option>
        <option value="+3">In 3 days</option>
        <option value="+7">In 7 days</option>
        <option value="+14">In 14 days</option>
        <option value="+30">In 30 days</option>
        <option value="-1">Yesterday (−1 day)</option>
        <option value="-7">7 days ago</option>
      </NativeSelect>
    );
  }

  // Default: free text (text, link, etc.)
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      className={inputCls + " flex-1"} placeholder="Enter value…" />
  );
}

// ── ValueRuleRow ─────────────────────────────────────────────────────────────
// One collapsible rule: "When [source col] = [value]" → N field changes
function ValueRuleRow({ rule, sourceCol, columns, onChange, onDelete }: {
  rule: ValueRule;
  sourceCol: Column;
  columns: Column[];
  onChange: (patch: Partial<ValueRule>) => void;
  onDelete: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const matchedLabel = sourceCol.config?.labels?.find(l => l.text === rule.whenValue);

  const addChange = () =>
    onChange({ fieldChanges: [...rule.fieldChanges, { columnId: "", value: "" }] });

  const updateChange = (cIdx: number, patch: Partial<FieldChange>) =>
    onChange({ fieldChanges: rule.fieldChanges.map((c, i) => i === cIdx ? { ...c, ...patch } : c) });

  const removeChange = (cIdx: number) =>
    onChange({ fieldChanges: rule.fieldChanges.filter((_, i) => i !== cIdx) });

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      {/* Rule header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 border-b border-gray-100">
        <button type="button" onClick={() => setCollapsed(p => !p)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <ChevronDown className={cn("h-3.5 w-3.5 text-gray-600 flex-shrink-0 transition-transform duration-150", collapsed && "-rotate-90")} />
          {matchedLabel?.color && (
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: matchedLabel.color }} />
          )}
          <span className="text-xs text-gray-500">When</span>
          <span className="text-xs font-bold text-gray-800 truncate">
            &quot;{sourceCol.name}&quot;
          </span>
          <span className="text-xs text-gray-500">is</span>
          {rule.whenValue ? (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-md"
              style={matchedLabel?.color
                ? { backgroundColor: matchedLabel.color + "22", color: matchedLabel.color }
                : { backgroundColor: "#f1f5f9", color: "#475569" }}>
              &quot;{rule.whenValue}&quot;
            </span>
          ) : (
            <span className="text-xs text-gray-600 italic">(any)</span>
          )}
          <span className="ml-auto text-[10px] text-gray-600 flex-shrink-0">
            {rule.fieldChanges.length} change{rule.fieldChanges.length !== 1 ? "s" : ""}
          </span>
        </button>
        <button type="button" onClick={onDelete}
          className="p-1 rounded hover:bg-red-50 text-gray-700 hover:text-red-500 flex-shrink-0 transition-colors">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Field changes for this rule value */}
      {!collapsed && (
        <div className="px-3 py-3 space-y-2 bg-white">
          {rule.fieldChanges.length === 0 ? (
            <div className="flex flex-col items-center py-3 gap-1">
              <p className="text-xs text-gray-600">No field changes yet.</p>
              <button type="button" onClick={addChange}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                + Add first change
              </button>
            </div>
          ) : (
            rule.fieldChanges.map((chg, cIdx) => {
              const targetCol = columns.find(c => c.id === chg.columnId);
              return (
                <div key={cIdx} className="flex items-end gap-2 group/chg">
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-gray-600 font-semibold uppercase tracking-wide mb-1">
                        Set column
                      </label>
                      <NativeSelect value={chg.columnId}
 onChange={e => updateChange(cIdx, { columnId: e.target.value, value: "" })}
                        className={selectCls}>
                        <option value="">Select column…</option>
                        {columns.map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
                        ))}
                      </NativeSelect>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-600 font-semibold uppercase tracking-wide mb-1">
                        To value
                      </label>
                      {targetCol ? (
                        <FieldValueInput
                          col={targetCol}
                          value={chg.value}
                          onChange={v => updateChange(cIdx, { value: v })}
                        />
                      ) : (
                        <input disabled className={inputCls + " opacity-40"}
                          placeholder="Select a column first" />
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={() => removeChange(cIdx)}
                    className="p-1.5 rounded text-gray-900 hover:text-red-500 hover:bg-red-50 flex-shrink-0 mb-px opacity-0 group-hover/chg:opacity-100 transition-all">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })
          )}
          {rule.fieldChanges.length > 0 && (
            <button type="button" onClick={addChange}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors pt-1">
              <Plus className="h-3 w-3" />Add field change
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── ValueRulesEditor ─────────────────────────────────────────────────────────
// Top-level editor for change_field: pick a source column, then define per-option rules.
// When triggerColumnId is provided (trigger = "column_changed"), the source column
// is automatically locked to the trigger column — no separate picker shown.
function ValueRulesEditor({ columns, actionConfig, onChange, triggerColumnId }: {
  columns: Column[];
  actionConfig: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  triggerColumnId?: string;
}) {
  const lockedToTrigger = !!triggerColumnId;
  const sourceColumnId = lockedToTrigger
    ? triggerColumnId
    : (actionConfig.sourceColumnId as string) ?? "";
  const valueRules = (actionConfig.valueRules as ValueRule[]) ?? [];
  const sourceCol = columns.find(c => c.id === sourceColumnId);
  const labels = sourceCol?.config?.labels ?? [];

  // When the trigger column changes, auto-sync actionConfig.sourceColumnId
  useEffect(() => {
    if (triggerColumnId && actionConfig.sourceColumnId !== triggerColumnId) {
      onChange({ ...actionConfig, sourceColumnId: triggerColumnId, valueRules: [] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerColumnId]);

  const setSourceColumn = (colId: string) =>
    onChange({ ...actionConfig, sourceColumnId: colId, valueRules: [] });

  const addRuleForValue = (val: string) =>
    onChange({ ...actionConfig, valueRules: [...valueRules, { whenValue: val, fieldChanges: [] }] });

  const updateRule = (idx: number, patch: Partial<ValueRule>) => {
    const updated = valueRules.map((r, i) => i === idx ? { ...r, ...patch } : r);
    onChange({ ...actionConfig, valueRules: updated });
  };

  const removeRule = (idx: number) =>
    onChange({ ...actionConfig, valueRules: valueRules.filter((_, i) => i !== idx) });

  // Labels that don't yet have a rule
  const unusedLabels = labels.filter(l => !valueRules.some(r => r.whenValue === l.text));

  return (
    <div className="space-y-3">
      {/* Source column — locked banner when driven by trigger, picker otherwise */}
      {lockedToTrigger ? (
        sourceCol ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-100">
            <RefreshCw className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
            <p className="text-[11px] text-blue-700">
              Triggered by <strong>{sourceCol.name}</strong> changing — define what happens for each value below.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 border border-yellow-100">
            <p className="text-[11px] text-yellow-700">Select which column to watch in the Trigger step first.</p>
          </div>
        )
      ) : (
        <div>
          <label className={labelCls}>Watch which column?</label>
          <NativeSelect value={sourceColumnId} onChange={e => setSourceColumn(e.target.value)} className={selectCls}>
            <option value="">Select column…</option>
            {columns.map(c => (
              <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
            ))}
          </NativeSelect>
          {sourceCol && (
            <p className="text-[11px] text-gray-600 mt-1">
              When <strong>{sourceCol.name}</strong> changes to a specific value, apply the matching field changes below.
            </p>
          )}
        </div>
      )}

      {sourceCol && (
        <>
          {/* Existing per-value rules */}
          {valueRules.length === 0 && (
            <div className="flex flex-col items-center py-6 border-2 border-dashed border-gray-200 rounded-xl gap-1">
              <Hash className="h-5 w-5 text-gray-900" />
              <p className="text-xs text-gray-600">No rules yet.</p>
              {labels.length > 0 && (
                <p className="text-[11px] text-gray-600">Click an option below to add a rule.</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            {valueRules.map((rule, idx) => (
              <ValueRuleRow
                key={idx}
                rule={rule}
                sourceCol={sourceCol}
                columns={columns}
                onChange={patch => updateRule(idx, patch)}
                onDelete={() => removeRule(idx)}
              />
            ))}
          </div>

          {/* Add rules for unused label options */}
          {labels.length > 0 ? (
            unusedLabels.length > 0 ? (
              <div>
                <p className="text-[10px] font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Add rule for option</p>
                <div className="flex flex-wrap gap-1.5">
                  {unusedLabels.map(l => (
                    <button key={l.id} type="button" onClick={() => addRuleForValue(l.text)}
                      className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-dashed hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 transition-all"
                      style={{ borderColor: l.color ? l.color + "66" : undefined, color: l.color ?? "#64748b" }}>
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: l.color ?? "#94a3b8" }} />
                      + When &quot;{l.text}&quot;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-gray-600 italic text-center py-1">
                All options have rules defined.
              </p>
            )
          ) : (
            // Column has no labels (text/number/date) — allow adding free rules
            <button type="button" onClick={() => addRuleForValue("")}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              <Plus className="h-3 w-3" />Add rule
            </button>
          )}
        </>
      )}
    </div>
  );
}

function ActionStep({ auto, columns, members, onChange }: StepProps) {
  const action = getAction(auto.actionType ?? "notify_user");
  const Icon = action.icon;
  return (
    <div className="space-y-3">
      <div className={cn("inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold", action.color)}>
        <Icon className="h-3.5 w-3.5" />
        ACTION
      </div>
      <div>
        <label className={labelCls}>Then do this…</label>
        <NativeSelect value={auto.actionType ?? "notify_user"} onChange={e => onChange({ actionType: e.target.value, actionConfig: {} })} className={selectCls}>
          {ACTION_TYPES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
        </NativeSelect>
      </div>
      {auto.actionType === "notify_user" && (
        <>
          <div>
            <label className={labelCls}>Notify who?</label>
            <NativeSelect value={(auto.actionConfig?.userId as string) ?? ""} onChange={e => onChange({ actionConfig: { ...auto.actionConfig, userId: e.target.value } })} className={selectCls}>
              <option value="">Select person…</option>
              {members.map(m => <option key={m.userId} value={m.userId}>{m.name || m.email}</option>)}
            </NativeSelect>
          </div>
          <div>
            <label className={labelCls}>Message</label>
            <input value={(auto.actionConfig?.message as string) ?? ""} onChange={e => onChange({ actionConfig: { ...auto.actionConfig, message: e.target.value } })} className={inputCls} placeholder="Notification message…" />
          </div>
        </>
      )}
      {auto.actionType === "send_email" && (
        <>
          <div>
            <label className={labelCls}>To email</label>
            <input type="email" value={(auto.actionConfig?.to as string) ?? ""} onChange={e => onChange({ actionConfig: { ...auto.actionConfig, to: e.target.value } })} className={inputCls} placeholder="recipient@example.com" />
          </div>
          <div>
            <label className={labelCls}>Subject</label>
            <input value={(auto.actionConfig?.subject as string) ?? ""} onChange={e => onChange({ actionConfig: { ...auto.actionConfig, subject: e.target.value } })} className={inputCls} placeholder="Email subject" />
          </div>
          <div>
            <label className={labelCls}>Body</label>
            <textarea value={(auto.actionConfig?.body as string) ?? ""} onChange={e => onChange({ actionConfig: { ...auto.actionConfig, body: e.target.value } })} className={inputCls + " resize-none"} rows={3} placeholder="Email body…" />
          </div>
        </>
      )}
      {auto.actionType === "change_field" && (() => {
        const isTriggerColChange = auto.triggerType === "column_changed";
        const triggerColId = (auto.triggerConfig?.columnId as string) || "";
        const triggerToValue = (auto.triggerConfig?.toValue as string) || "";
        const triggerCol = columns.find(c => c.id === triggerColId);

        // Specific value filter set → flat action mode
        if (isTriggerColChange && triggerColId && triggerToValue && triggerCol) {
          return (
            <FlatFieldChangesEditor
              triggerCol={triggerCol}
              toValue={triggerToValue}
              columns={columns}
              fieldChanges={(auto.actionConfig?.fieldChanges as FieldChange[]) ?? []}
              onChange={changes => onChange({ actionConfig: { ...auto.actionConfig, fieldChanges: changes } })}
            />
          );
        }

        // No specific value → per-value branching rules
        return (
          <ValueRulesEditor
            columns={columns}
            actionConfig={auto.actionConfig ?? {}}
            onChange={config => onChange({ actionConfig: config })}
            triggerColumnId={isTriggerColChange ? (triggerColId || undefined) : undefined}
          />
        );
      })()}
      {auto.actionType === "set_date" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelCls}>Date column</label>
            <NativeSelect value={(auto.actionConfig?.columnId as string) ?? ""} onChange={e => onChange({ actionConfig: { ...auto.actionConfig, columnId: e.target.value } })} className={selectCls}>
              <option value="">Select column</option>
              {columns.filter(c => c.type === "date").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </NativeSelect>
          </div>
          <div>
            <label className={labelCls}>Days from now</label>
            <input type="number" value={(auto.actionConfig?.daysFromNow as number) ?? 0} onChange={e => onChange({ actionConfig: { ...auto.actionConfig, daysFromNow: Number(e.target.value) } })} className={inputCls} />
          </div>
        </div>
      )}
    </div>
  );
}

function RecipeCard({ auto, onToggle, onDelete, expanded, onExpand, columns, members, onUpdate }: {
  auto: Automation; onToggle: () => void; onDelete: () => void;
  expanded: boolean; onExpand: () => void;
  columns: Column[]; members: Member[]; onUpdate: (u: Partial<Automation>) => void;
}) {
  // Local draft — changes stay here until the user clicks Save
  const [draft, setDraft] = useState<Automation>(auto);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Fetch run history whenever the card is expanded
  useEffect(() => {
    if (!expanded) return;
    setLogsLoading(true);
    fetch(`/api/automations/${auto.id}`)
      .then(r => r.json())
      .then(d => setLogs(Array.isArray(d.logs) ? d.logs : []))
      .catch(() => {})
      .finally(() => setLogsLoading(false));
  }, [expanded, auto.id]);

  // When another user action changes `auto` from outside (e.g. toggle active),
  // re-sync only fields that aren't part of the editor (isActive).
  // We intentionally do NOT reset the draft on every `auto` change to avoid
  // losing in-progress edits.
  useEffect(() => {
    setDraft(prev => ({ ...prev, isActive: auto.isActive }));
  }, [auto.isActive]);

  // Reset the whole draft when the card is collapsed (discard unsaved changes)
  useEffect(() => {
    if (!expanded) setDraft(auto);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const isDirty =
    draft.name !== auto.name ||
    draft.triggerType !== auto.triggerType ||
    JSON.stringify(draft.triggerConfig) !== JSON.stringify(auto.triggerConfig) ||
    draft.actionType !== auto.actionType ||
    JSON.stringify(draft.actionConfig) !== JSON.stringify(auto.actionConfig);

  const handleSave = async () => {
    setSaving(true);
    await onUpdate({
      name: draft.name,
      triggerType: draft.triggerType,
      triggerConfig: draft.triggerConfig,
      actionType: draft.actionType,
      actionConfig: draft.actionConfig,
    });
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  };

  const trigger = getTrigger(draft.triggerType);
  const action = getAction(draft.actionType);
  const TIcon = trigger.icon;
  const AIcon = action.icon;

  return (
    <div className={cn("bg-white rounded-xl border transition-all", expanded ? "border-blue-200 shadow-md shadow-blue-50" : "border-gray-200 hover:border-gray-300 hover:shadow-sm")}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button onClick={onToggle} title={auto.isActive ? "Pause" : "Enable"} className="flex-shrink-0 transition-transform hover:scale-110">
          {auto.isActive
            ? <ToggleRight className="h-6 w-6 text-blue-600" />
            : <ToggleLeft className="h-6 w-6 text-gray-700" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{draft.name || auto.name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md", trigger.color)}>
              <TIcon className="h-2.5 w-2.5" />{trigger.label}
            </span>
            <ChevronRight className="h-3 w-3 text-gray-700 flex-shrink-0" />
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md", action.color)}>
              <AIcon className="h-2.5 w-2.5" />{action.label}
            </span>
          </div>
        </div>
        <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 border",
          auto.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200")}>
          {auto.isActive ? "Active" : "Paused"}
        </span>
        <button onClick={onExpand} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 flex-shrink-0 transition-colors">
          <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", expanded && "rotate-180")} />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-700 hover:text-red-500 flex-shrink-0 transition-colors">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-5 bg-gray-50/60 rounded-b-xl space-y-4">
          {/* Name */}
          <div>
            <label className={labelCls}>Automation name</label>
            <input
              value={draft.name}
              onChange={e => setDraft(p => ({ ...p, name: e.target.value }))}
              className={inputCls}
              placeholder="Give this automation a name…"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <TriggerStep
                auto={draft}
                columns={columns}
                members={members}
                onChange={u => setDraft(p => ({ ...p, ...u }))}
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <ActionStep
                auto={draft}
                columns={columns}
                members={members}
                onChange={u => setDraft(p => ({ ...p, ...u }))}
              />
            </div>
          </div>

          {/* Save / discard row */}
          <div className="flex items-center justify-end gap-2 pt-1">
            {isDirty && (
              <span className="text-[11px] text-amber-600 font-medium mr-auto">Unsaved changes</span>
            )}
            {savedFlash && !isDirty && (
              <span className="flex items-center gap-1 text-[11px] text-green-600 font-medium mr-auto">
                <CheckCircle2 className="h-3.5 w-3.5" />Saved
              </span>
            )}
            <button
              type="button"
              onClick={() => { setDraft(auto); }}
              disabled={!isDirty}
              className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-30 transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>

          {/* Run history */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide mb-2">Run history</p>
            {logsLoading ? (
              <div className="flex items-center gap-2 py-2 text-xs text-gray-600">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />Loading…
              </div>
            ) : logs.length === 0 ? (
              <p className="text-xs text-gray-600 italic py-1">No runs yet — this automation hasn&apos;t fired.</p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {logs.map(log => (
                  <div key={log.id} className={cn(
                    "flex items-start gap-2 px-3 py-2 rounded-lg text-xs",
                    log.status === "success" ? "bg-green-50" : "bg-red-50"
                  )}>
                    {log.status === "success"
                      ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      : <Circle className="h-3.5 w-3.5 text-red-600 flex-shrink-0 mt-0.5" />}
                    <div className="min-w-0 flex-1">
                      <span className={log.status === "success" ? "text-green-700 font-medium" : "text-red-700 font-medium"}>
                        {log.status === "success" ? "Success" : "Error"}
                      </span>
                      {log.status === "error" && (log.details as { error?: string }).error && (
                        <span className="text-red-500 ml-1">— {(log.details as { error: string }).error}</span>
                      )}
                    </div>
                    <span className="text-gray-600 flex-shrink-0 whitespace-nowrap">{timeAgo(log.triggeredAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const RECIPE_EXAMPLES = [
  { trigger: "item_created", action: "notify_user", label: "Notify someone when a task is created" },
  { trigger: "status_changed", action: "send_email", label: "Email your team when status changes" },
  { trigger: "date_reached", action: "notify_user", label: "Remind someone before a due date" },
  { trigger: "form_submitted", action: "change_field", label: "Auto-assign items from form submissions" },
];

export default function AutomationsPage() {
  const confirmAction = useConfirm();
  const params = useParams();
  const boardId = params.id as string;

  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Column[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newAuto, setNewAuto] = useState<Partial<Automation>>({ name: "", triggerType: "item_created", triggerConfig: {}, actionType: "notify_user", actionConfig: {} });
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ar, br] = await Promise.all([
        fetch(`/api/boards/${boardId}/automations`),
        fetch(`/api/boards/${boardId}`),
      ]);
      setAutomations(Array.isArray(await ar.clone().json()) ? await ar.json() : []);
      const bd = await br.json();
      setColumns(bd.columns || []);
      setMembers(bd.members || []);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const createAutomation = async () => {
    if (!newAuto.name?.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/automations`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newAuto),
      });
      if (res.ok) {
        const a = await res.json();
        setAutomations(p => [a, ...p]);
        setShowCreate(false);
        setNewAuto({ name: "", triggerType: "item_created", triggerConfig: {}, actionType: "notify_user", actionConfig: {} });
      }
    } finally { setSaving(false); }
  };

  const toggleActive = async (auto: Automation) => {
    const updated = { ...auto, isActive: !auto.isActive };
    setAutomations(p => p.map(a => a.id === auto.id ? updated : a));
    await fetch(`/api/automations/${auto.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !auto.isActive }) });
  };

  const deleteAutomation = async (id: string) => {
    if (!(await confirmAction("Delete this automation?"))) return;
    await fetch(`/api/automations/${id}`, { method: "DELETE" });
    setAutomations(p => p.filter(a => a.id !== id));
  };

  const updateAutomation = async (id: string, updates: Partial<Automation>) => {
    setAutomations(p => p.map(a => a.id === id ? { ...a, ...updates } : a));
    await fetch(`/api/automations/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
  };

  const activeCount = automations.filter(a => a.isActive).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link href={`/dashboard/boards/${boardId}`} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
              <Bot className="h-4 w-4 text-gray-900" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 leading-none">Automations</h1>
              <p className="text-[11px] text-gray-600 mt-0.5">Automate repetitive work on this board</p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            {automations.length > 0 && (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />{activeCount} active</span>
                <span className="flex items-center gap-1"><Circle className="h-3.5 w-3.5 text-gray-700" />{automations.length - activeCount} paused</span>
              </div>
            )}
            <button onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all shadow-sm shadow-blue-200">
              <Plus className="h-4 w-4" />New Automation
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">

          {/* Create form */}
          {showCreate && (
            <div className="bg-white rounded-2xl border-2 border-blue-500 shadow-lg shadow-blue-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-gray-900">New Automation Recipe</h2>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-xs text-gray-600 hover:text-gray-600 transition-colors">Cancel</button>
              </div>
              <div className="px-6 pt-4 pb-3">
                <label className={labelCls}>Automation name</label>
                <input value={newAuto.name ?? ""} onChange={e => setNewAuto(p => ({ ...p, name: e.target.value }))} autoFocus
                  className={inputCls + " text-base font-semibold"} placeholder="e.g. Notify on status change" />
              </div>
              <div className="px-6 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-violet-50 rounded-xl border border-violet-100 p-4">
                  <TriggerStep auto={newAuto} columns={columns} members={members} onChange={u => setNewAuto(p => ({ ...p, ...u }))} />
                </div>
                <div className="bg-blue-50 rounded-xl border border-blue-100 p-4">
                  <ActionStep auto={newAuto} columns={columns} members={members} onChange={u => setNewAuto(p => ({ ...p, ...u }))} />
                </div>
              </div>
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center gap-3">
                <button onClick={createAutomation} disabled={saving || !newAuto.name?.trim()}
                  className="px-5 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 transition-all shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Save Automation
                </button>
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-500 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
              </div>
            </div>
          )}

          {/* Loading */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="text-sm text-gray-600">Loading automations…</p>
            </div>
          ) : automations.length === 0 && !showCreate ? (
            /* Empty state */
            <div className="bg-white rounded-2xl border border-gray-200 px-8 py-12 text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Bot className="h-8 w-8 text-blue-500" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">No automations yet</h3>
              <p className="text-sm text-gray-600 mb-6 max-w-xs mx-auto">Set up rules to automate repetitive tasks and keep your team in sync.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto mb-6">
                {RECIPE_EXAMPLES.map(ex => {
                  const t = getTrigger(ex.trigger); const a = getAction(ex.action);
                  const TI = t.icon; const AI = a.icon;
                  return (
                    <button key={ex.label} onClick={() => { setNewAuto({ name: ex.label, triggerType: ex.trigger, triggerConfig: {}, actionType: ex.action, actionConfig: {} }); setShowCreate(true); }}
                      className="text-left p-3 rounded-xl border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className={cn("flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded", t.color)}><TI className="h-2.5 w-2.5" />{t.label}</span>
                        <ChevronRight className="h-3 w-3 text-gray-700" />
                        <span className={cn("flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded", a.color)}><AI className="h-2.5 w-2.5" />{a.label}</span>
                      </div>
                      <p className="text-xs text-gray-600 group-hover:text-blue-700">{ex.label}</p>
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-all shadow-sm shadow-blue-200">
                <Plus className="h-4 w-4" />Create your first automation
              </button>
            </div>
          ) : (
            /* Automation list */
            <div className="space-y-3">
              {automations.map(auto => (
                <RecipeCard key={auto.id} auto={auto}
                  onToggle={() => toggleActive(auto)}
                  onDelete={() => deleteAutomation(auto.id)}
                  expanded={expandedId === auto.id}
                  onExpand={() => setExpandedId(expandedId === auto.id ? null : auto.id)}
                  columns={columns} members={members}
                  onUpdate={u => updateAutomation(auto.id, u)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
