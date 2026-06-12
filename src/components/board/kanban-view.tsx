"use client";

import { NativeSelect } from "@/components/ui";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { BoardData, ItemDef, CellValue, LabelConfig } from "@/lib/types";
import { Board as KanbanSquare } from "@vibe/icons";

interface KanbanViewProps {
  board: BoardData;
  /** Same signature as the table view's cell updater (optimistic + persisted). */
  onUpdateCell: (itemId: string, columnId: string, value: Partial<CellValue>) => void;
  onItemClick: (itemId: string) => void;
}

const UNSET = "__unset__";

/** monday-style kanban: one lane per status label, drag cards between lanes. */
export function KanbanView({ board, onUpdateCell, onItemClick }: KanbanViewProps) {
  const statusColumns = board.columns.filter((c) => c.type === "status");
  const [statusColumnId, setStatusColumnId] = useState<string | null>(statusColumns[0]?.id ?? null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverLane, setDragOverLane] = useState<string | null>(null);

  const statusColumn = statusColumns.find((c) => c.id === statusColumnId) ?? statusColumns[0] ?? null;
  const labels = useMemo(
    () => ((statusColumn?.config as { labels?: LabelConfig[] })?.labels ?? []),
    [statusColumn]
  );

  const lanes = useMemo(() => {
    const map = new Map<string, ItemDef[]>();
    map.set(UNSET, []);
    for (const l of labels) map.set(l.id, []);
    if (!statusColumn) return map;
    for (const item of board.items) {
      const v = item.values[statusColumn.id]?.jsonValue as { id?: string } | null | undefined;
      const key = v?.id && map.has(v.id) ? v.id : UNSET;
      map.get(key)!.push(item);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.position - b.position);
    return map;
  }, [board.items, labels, statusColumn]);

  if (!statusColumn) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <KanbanSquare className="h-8 w-8 text-gray-700" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">No status column</h3>
          <p className="text-xs text-gray-600">Add a <strong>Status</strong> column to see items as a kanban board.</p>
        </div>
      </div>
    );
  }

  const drop = (laneId: string) => {
    setDragOverLane(null);
    if (!dragItemId) return;
    const label = labels.find((l) => l.id === laneId) ?? null;
    onUpdateCell(dragItemId, statusColumn.id, { jsonValue: label });
    setDragItemId(null);
  };

  const groupOf = (item: ItemDef) => board.groups.find((g) => g.id === item.groupId);
  const laneDefs: { id: string; text: string; color: string }[] = [
    ...labels.map((l) => ({ id: l.id, text: l.text, color: l.color })),
    { id: UNSET, text: "No status", color: "#9ca3af" },
  ];

  return (
    <div className="h-full px-6 py-4 overflow-x-auto">
      {statusColumns.length > 1 && (
        <div className="mb-3">
          <NativeSelect
 value={statusColumn.id}
 onChange={(e) => setStatusColumnId(e.target.value)}
            className="bg-white border border-gray-200 rounded-md px-2.5 py-1.5 text-xs text-gray-700"
          >
            {statusColumns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div className="flex gap-4 items-start min-h-[60vh]">
        {laneDefs.map((lane) => {
          const items = lanes.get(lane.id) ?? [];
          if (lane.id === UNSET && items.length === 0) return null;
          return (
            <div
              key={lane.id}
              onDragOver={(e) => { e.preventDefault(); setDragOverLane(lane.id); }}
              onDragLeave={() => setDragOverLane((l) => (l === lane.id ? null : l))}
              onDrop={() => drop(lane.id)}
              className={cn(
                "w-72 shrink-0 rounded-lg border bg-gray-50 transition-colors",
                dragOverLane === lane.id ? "border-blue-400 bg-blue-50" : "border-gray-200"
              )}
            >
              <div className="px-3 py-2.5 flex items-center gap-2 border-b border-gray-200">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: lane.color }} />
                <span className="text-xs font-semibold text-gray-700">{lane.text}</span>
                <span className="ml-auto text-[11px] text-gray-400 font-medium">{items.length}</span>
              </div>
              <div className="p-2 space-y-2 min-h-[80px]">
                {items.map((item) => {
                  const group = groupOf(item);
                  return (
                    <div
                      key={item.id}
                      draggable
                      onDragStart={() => setDragItemId(item.id)}
                      onDragEnd={() => { setDragItemId(null); setDragOverLane(null); }}
                      onClick={() => onItemClick(item.id)}
                      className={cn(
                        "bg-white border border-gray-200 rounded-md px-3 py-2.5 shadow-sm cursor-pointer hover:border-blue-300 hover:shadow",
                        dragItemId === item.id && "opacity-50"
                      )}
                    >
                      <div className="text-sm text-gray-900 leading-snug">{item.name}</div>
                      <div className="mt-2 flex items-center gap-2">
                        {group && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: group.color }} />
                            {group.name}
                          </span>
                        )}
                        {item.endDate && (
                          <span className={cn(
                            "ml-auto text-[11px]",
                            new Date(item.endDate) < new Date() ? "text-red-600 font-medium" : "text-gray-400"
                          )}>
                            {new Date(item.endDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="text-[11px] text-gray-400 text-center py-4">Drop items here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
