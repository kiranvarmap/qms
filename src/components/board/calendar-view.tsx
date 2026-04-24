"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { BoardData, ItemDef } from "@/lib/types";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

interface CalendarViewProps { board: BoardData; }

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ board }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const dateColumns = board.columns.filter(c => c.type === "date");

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); };

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startPad = firstDay.getDay();
  const totalCells = startPad + lastDay.getDate();
  const rows = Math.ceil(totalCells / 7);

  const itemsByDate = useMemo(() => {
    const map: Record<string, ItemDef[]> = {};
    for (const item of board.items) {
      for (const col of dateColumns) {
        const val = item.values[col.id];
        if (val?.dateValue) {
          const key = val.dateValue.slice(0, 10);
          if (!map[key]) map[key] = [];
          if (!map[key].find(i => i.id === item.id)) map[key].push(item);
        }
      }
    }
    return map;
  }, [board.items, dateColumns]);

  const getGroup = (item: ItemDef) => board.groups.find(g => g.id === item.groupId);
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (dateColumns.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-12">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
          <CalendarDays className="h-8 w-8 text-gray-300" />
        </div>
        <div className="text-center">
          <h3 className="text-sm font-semibold text-gray-600 mb-1">No date columns</h3>
          <p className="text-xs text-gray-400">Add a <strong>Date</strong> column to see items in the calendar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-white flex-shrink-0">
        <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden">
          <button onClick={prevMonth} className="px-2 py-1.5 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors border-r border-gray-200">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => { setMonth(today.getMonth()); setYear(today.getFullYear()); }}
            className="px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors">
            Today
          </button>
          <button onClick={nextMonth} className="px-2 py-1.5 hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors border-l border-gray-200">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <h2 className="text-sm font-bold text-gray-900">
          {firstDay.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        <div className="h-full flex flex-col" style={{ minHeight: rows * 110 + 32 }}>
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-gray-200 flex-shrink-0 bg-gray-50">
            {WEEKDAYS.map(wd => (
              <div key={wd} className={cn("py-2 text-center text-xs font-bold text-gray-400 uppercase tracking-wide border-r border-gray-100 last:border-r-0",
                (wd === "Sun" || wd === "Sat") && "text-gray-300")}>
                {wd}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${rows}, minmax(100px, 1fr))` }}>
            {Array.from({ length: rows * 7 }, (_, i) => {
              const dayNum = i - startPad + 1;
              if (dayNum < 1 || dayNum > lastDay.getDate()) {
                return <div key={i} className={cn("border-b border-r border-gray-100 last:border-r-0", i % 7 === 6 && "border-r-0")} />;
              }
              const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
              const dayItems = itemsByDate[dateKey] ?? [];
              const isTodayDay = dateKey === todayKey;
              const isWeekend = i % 7 === 0 || i % 7 === 6;

              return (
                <div key={i} className={cn("border-b border-r border-gray-100 last:border-r-0 p-2 flex flex-col transition-colors",
                  i % 7 === 6 && "border-r-0",
                  isTodayDay ? "bg-blue-50/60" : isWeekend ? "bg-gray-50/40" : "bg-white hover:bg-gray-50/50")}>
                  <span className={cn("text-xs font-bold self-start w-6 h-6 flex items-center justify-center rounded-full mb-1.5 transition-colors",
                    isTodayDay ? "bg-blue-600 text-white shadow-sm" : isWeekend ? "text-gray-300" : "text-gray-500")}>
                    {dayNum}
                  </span>
                  <div className="space-y-0.5 flex-1 overflow-hidden">
                    {dayItems.slice(0, 3).map(item => {
                      const group = getGroup(item);
                      return (
                        <div key={item.id}
                          className="text-[10px] px-1.5 py-0.5 rounded-md text-white truncate font-semibold leading-tight cursor-default hover:brightness-110 transition-all"
                          style={{ backgroundColor: group?.color ?? "#6366f1" }}
                          title={item.name}>
                          {item.name}
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <div className="text-[10px] text-gray-400 font-medium px-0.5">+{dayItems.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
