"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { BoardData, ItemDef } from "@/lib/types";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface GanttViewProps { board: BoardData; }

function getDaysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function GanttView({ board }: GanttViewProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dateColumns = board.columns.filter(c => c.type === "date");
  const [offsetWeeks, setOffsetWeeks] = useState(0);

  const DAY_PX = 32;
  const DAYS_SHOWN = 28;
  const NAME_COL = 200;

  const startDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + offsetWeeks * 7 - 7);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [offsetWeeks, today]);

  const days = useMemo(() => Array.from({ length: DAYS_SHOWN }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    return d;
  }), [startDate]);

  const allItems: ItemDef[] = board.groups.flatMap(g =>
    board.items.filter(i => i.groupId === g.id).sort((a, b) => a.position - b.position)
  );

  const getItemDateRange = (item: ItemDef): { start: Date | null; end: Date | null } => {
    // Prefer the task's first-class Start/End dates.
    if (item.startDate || item.endDate) {
      const s = item.startDate ? new Date(item.startDate) : null;
      const e = item.endDate ? new Date(item.endDate) : null;
      s?.setHours(0, 0, 0, 0);
      e?.setHours(0, 0, 0, 0);
      return { start: s ?? e, end: e ?? s };
    }
    // Fallback: min/max of any date columns.
    let start: Date | null = null;
    let end: Date | null = null;
    for (const col of dateColumns) {
      const val = item.values[col.id];
      if (val?.dateValue) {
        const d = new Date(val.dateValue);
        d.setHours(0, 0, 0, 0);
        if (!start || d < start) start = d;
        if (!end || d > end) end = d;
      }
    }
    return { start, end };
  };

  const anyItemHasDates = allItems.some((i) => i.startDate || i.endDate);

  const todayOffset = getDaysBetween(startDate, today);

  const MONTH_LABELS: string[] = [];
  let prevMonth = -1;
  days.forEach(d => {
    if (d.getMonth() !== prevMonth) { MONTH_LABELS.push(d.toLocaleDateString(undefined, { month: "short", year: "2-digit" })); prevMonth = d.getMonth(); }
    else MONTH_LABELS.push("");
  });

  if (dateColumns.length === 0 && !anyItemHasDates) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <CalendarDays className="h-8 w-8 text-gray-700" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">No task dates yet</h3>
          <p className="text-xs text-gray-600">Set a task&apos;s <strong>Start</strong> and <strong>End date</strong> (open a task) to see the Gantt chart.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={() => setOffsetWeeks(p => p - 2)} className="px-2 py-1.5 hover:bg-gray-50 text-gray-600 hover:text-gray-600 transition-colors border-r border-gray-200">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => setOffsetWeeks(0)} className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
            Today
          </button>
          <button onClick={() => setOffsetWeeks(p => p + 2)} className="px-2 py-1.5 hover:bg-gray-50 text-gray-600 hover:text-gray-600 transition-colors border-l border-gray-200">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <span className="text-xs text-gray-500 font-medium">
          {startDate.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {days[days.length - 1].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <div style={{ minWidth: NAME_COL + DAY_PX * DAYS_SHOWN }}>
          {/* Header row */}
          <div className="flex sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
            <div className="flex-shrink-0 bg-gray-50 border-r border-gray-200 flex items-center px-4" style={{ width: NAME_COL }}>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Item</span>
            </div>
            <div className="flex border-l border-gray-100">
              {days.map((d, i) => {
                const isTodayDay = getDaysBetween(d, today) === 0;
                const isSun = d.getDay() === 0;
                return (
                  <div key={i} className={cn("flex-shrink-0 flex flex-col items-center justify-center border-r border-gray-100 py-2",
                    isTodayDay ? "bg-blue-50" : isSun ? "bg-gray-50/60" : "bg-white")}
                    style={{ width: DAY_PX }}>
                    {MONTH_LABELS[i] && <span className="text-[8px] font-bold text-gray-700 uppercase tracking-wider leading-none mb-0.5">{MONTH_LABELS[i]}</span>}
                    <span className={cn("text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full",
                      isTodayDay ? "bg-blue-600 text-white" : "text-gray-500")}>{d.getDate()}</span>
                    <span className="text-[8px] text-gray-700 uppercase">{d.toLocaleDateString(undefined, { weekday: "narrow" })}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data rows */}
          {allItems.length === 0 && (
            <div className="py-16 text-center text-sm text-gray-600">No items in this board.</div>
          )}
          {allItems.map(item => {
            const { start, end } = getItemDateRange(item);
            const group = board.groups.find(g => g.id === item.groupId);
            let barLeft: number | null = null;
            let barWidth: number | null = null;
            if (start && end) {
              const s = getDaysBetween(startDate, start);
              const e = getDaysBetween(startDate, end);
              if (e >= 0 && s < DAYS_SHOWN) {
                barLeft = Math.max(0, s) * DAY_PX;
                barWidth = (Math.min(DAYS_SHOWN - 1, e) - Math.max(0, s) + 1) * DAY_PX;
              }
            }
            return (
              <div key={item.id} className="flex border-b border-gray-50 hover:bg-gray-50/50 transition-colors group">
                <div className="flex-shrink-0 px-4 py-2.5 border-r border-gray-200 flex items-center gap-2.5 bg-white group-hover:bg-gray-50/50 transition-colors" style={{ width: NAME_COL }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: group?.color ?? "#94a3b8" }} />
                  <span className="text-xs text-gray-700 truncate font-medium">{item.name}</span>
                </div>
                <div className="relative flex-shrink-0" style={{ width: DAY_PX * DAYS_SHOWN, height: 38 }}>
                  {/* Week separators */}
                  {days.map((d, i) => d.getDay() === 1 && i > 0 && (
                    <div key={i} className="absolute top-0 bottom-0 w-px bg-gray-100" style={{ left: i * DAY_PX }} />
                  ))}
                  {/* Today marker */}
                  {todayOffset >= 0 && todayOffset < DAYS_SHOWN && (
                    <div className="absolute top-0 bottom-0 w-0.5 bg-blue-400/50 z-10" style={{ left: todayOffset * DAY_PX + DAY_PX / 2 }} />
                  )}
                  {/* Bar */}
                  {barLeft !== null && barWidth !== null && barWidth > 0 && (
                    <div
                      className="absolute top-2.5 h-[22px] rounded-lg flex items-center px-2 text-[10px] font-semibold text-gray-900 shadow-sm transition-all hover:brightness-110"
                      style={{ left: barLeft + 3, width: Math.max(barWidth - 6, 6), backgroundColor: group?.color ?? "#6366f1" }}
                      title={item.name}>
                      {barWidth > 40 && <span className="truncate">{item.name}</span>}
                    </div>
                  )}
                  {/* Single dot for single date */}
                  {barLeft !== null && barWidth === DAY_PX && (
                    <div className="absolute top-3 w-4 h-4 rounded-full border-2 border-gray-200 shadow-sm flex items-center justify-center"
                      style={{ left: barLeft + DAY_PX / 2 - 8, backgroundColor: group?.color ?? "#6366f1" }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
