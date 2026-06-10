"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Loader2,
  ArrowLeft,
  Plus,
  Search,
  Filter,
  X,
  Trash2,
  Settings2,
  Download,
  ArrowUpDown,
  Table2,
  KanbanSquare,
  GanttChartSquare,
  Calendar,
  Bot,
  FormInput,
} from "lucide-react";
import type { BoardData, ColumnDef, ItemDef, GroupDef, CellValue, LabelConfig } from "@/lib/types";
import { BoardGroup } from "@/components/board/board-group";
// import { AddColumnMenu } from "@/components/board/add-column-menu";
import { FilterBar, type FilterCondition } from "@/components/board/filter-bar";
import { ItemDetailPanel } from "@/components/board/item-detail-panel";
import { BoardSettingsPanel } from "@/components/board/board-settings-panel";
import { GanttView } from "@/components/board/gantt-view";
import { CalendarView } from "@/components/board/calendar-view";
import { KanbanView } from "@/components/board/kanban-view";

export default function BoardPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const boardId = params.id as string;

  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  type ViewMode = "table" | "kanban" | "gantt" | "calendar";
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  type SortDir = "asc" | "desc";
  const [sortColumnId, setSortColumnId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const showSaveError = (msg: string) => {
    setSaveError(msg);
    setTimeout(() => setSaveError(null), 4000);
  };

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/boards/${boardId}`);
      if (!res.ok) {
        router.push("/dashboard/workspaces");
        return;
      }
      const data = await res.json();
      setBoard(data);
    } finally {
      setLoading(false);
    }
  }, [boardId, router]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  // ── Handlers ─────────────────────────────────────────────────────
  const addGroup = async () => {
    if (!board) return;
    const res = await fetch(`/api/boards/${boardId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "New Group" }),
    });
    if (res.ok) {
      const group = await res.json();
      setBoard({ ...board, groups: [...board.groups, group] });
    }
  };

  const updateGroup = async (groupId: string, updates: Partial<GroupDef>) => {
    // Optimistic update
    setBoard((prev) => {
      if (!prev) return prev;
      return { ...prev, groups: prev.groups.map((g) => g.id === groupId ? { ...g, ...updates } : g) };
    });
    const res = await fetch(`/api/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      // Revert
      fetchBoard();
      showSaveError("Failed to save group change. Please try again.");
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (board && board.groups.length <= 1) {
      alert("Cannot delete the last group.");
      return;
    }
    if (!confirm("Delete this group and all its items?")) return;
    await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        groups: prev.groups.filter((g) => g.id !== groupId),
        items: prev.items.filter((i) => i.groupId !== groupId),
      };
    });
  };

  const addItem = async (groupId: string, name: string) => {
    if (!board) return;
    const res = await fetch(`/api/boards/${boardId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupId, name }),
    });
    if (res.ok) {
      const item = await res.json();
      setBoard({ ...board, items: [...board.items, item] });
    }
  };

  const updateItem = async (itemId: string, updates: Partial<ItemDef>) => {
    // Optimistic update
    setBoard((prev) => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.map((i) => i.id === itemId ? { ...i, ...updates } : i) };
    });
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      fetchBoard();
      showSaveError("Failed to save item change. Please try again.");
    }
  };

  const deleteItem = async (itemId: string) => {
    await fetch(`/api/items/${itemId}`, { method: "DELETE" });
    setBoard((prev) => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter((i) => i.id !== itemId) };
    });
  };

  const updateCell = async (
    itemId: string,
    columnId: string,
    value: Partial<CellValue>
  ) => {
    // Snapshot for potential revert
    const prevBoard = board;
    // Optimistic update — show change immediately
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          i.id === itemId
            ? {
                ...i,
                values: {
                  ...i.values,
                  [columnId]: {
                    ...(i.values[columnId] || {
                      textValue: null,
                      numberValue: null,
                      booleanValue: null,
                      dateValue: null,
                      jsonValue: null,
                    }),
                    ...value,
                  },
                },
              }
            : i
        ),
      };
    });
    try {
      const res = await fetch(`/api/items/${itemId}/cells`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId, ...value }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        // Revert to last known good state
        if (prevBoard) setBoard(prevBoard);
        showSaveError(`Failed to save (${res.status}). ${errText.slice(0, 80)}`);
      } else {
        // Re-fetch after a short delay so any automation-applied field changes
        // become visible without a manual refresh
        setTimeout(fetchBoard, 900);
      }
    } catch {
      if (prevBoard) setBoard(prevBoard);
      showSaveError("Network error — change not saved. Check your connection.");
    }
  };

  const addColumn = async (name: string, type: string) => {
    if (!board) return;
    const res = await fetch(`/api/boards/${boardId}/columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    if (res.ok) {
      const col = await res.json();
      setBoard({ ...board, columns: [...board.columns, col] });
    }
  };

  const deleteColumn = async (columnId: string) => {
    if (!confirm("Delete this column and all its data?")) return;
    await fetch(`/api/columns/${columnId}`, { method: "DELETE" });
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.filter((c) => c.id !== columnId),
      };
    });
  };

  const updateColumn = async (columnId: string, updates: Partial<ColumnDef>) => {
    // Optimistic update
    setBoard((prev) => {
      if (!prev) return prev;
      return { ...prev, columns: prev.columns.map((c) => c.id === columnId ? { ...c, ...updates } : c) };
    });
    const res = await fetch(`/api/columns/${columnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      fetchBoard();
      showSaveError("Failed to save column change. Please try again.");
    }
  };

  // ── Move column ────────────────────────────────────────────────
  const moveColumn = async (columnId: string, direction: 'left' | 'right') => {
    if (!board) return;
    const sorted = [...board.columns].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((c) => c.id === columnId);
    const swapIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const col = sorted[idx];
    const swapCol = sorted[swapIdx];
    const colPos = col.position;
    const swapPos = swapCol.position;
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        columns: prev.columns.map((c) => {
          if (c.id === col.id) return { ...c, position: swapPos };
          if (c.id === swapCol.id) return { ...c, position: colPos };
          return c;
        }),
      };
    });
    await Promise.all([
      fetch(`/api/columns/${col.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: swapPos }),
      }),
      fetch(`/api/columns/${swapCol.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ position: colPos }),
      }),
    ]);
  };

  // ── Selection ──────────────────────────────────────────────────
  const toggleSelectItem = (itemId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAll = (itemIds: string[], select: boolean) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      itemIds.forEach((id) => {
        if (select) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  // ── Bulk operations ────────────────────────────────────────────
  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''}?`)) return;
    const ids = Array.from(selectedItems);
    await Promise.all(ids.map((id) => fetch(`/api/items/${id}`, { method: 'DELETE' })));
    setBoard((prev) => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.filter((i) => !selectedItems.has(i.id)) };
    });
    setSelectedItems(new Set());
  };

  const bulkMoveToGroup = async (targetGroupId: string) => {
    const ids = Array.from(selectedItems);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/items/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId: targetGroupId }),
        })
      )
    );
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          selectedItems.has(i.id) ? { ...i, groupId: targetGroupId } : i
        ),
      };
    });
    setSelectedItems(new Set());
  };

  const bulkUpdateCell = async (columnId: string, value: Partial<CellValue>) => {
    const ids = Array.from(selectedItems);
    await Promise.all(
      ids.map((id) =>
        fetch(`/api/items/${id}/cells`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columnId, ...value }),
        })
      )
    );
    setBoard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map((i) =>
          selectedItems.has(i.id)
            ? {
                ...i,
                values: {
                  ...i.values,
                  [columnId]: {
                    ...(i.values[columnId] || {
                      textValue: null,
                      numberValue: null,
                      booleanValue: null,
                      dateValue: null,
                      jsonValue: null,
                    }),
                    ...value,
                  },
                },
              }
            : i
        ),
      };
    });
    setSelectedItems(new Set());
  };

  // ── Export ────────────────────────────────────────────────────────
  const exportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/boards/${boardId}/export`);
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${board?.name ?? "board"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // ── Sort ─────────────────────────────────────────────────────────
  const toggleSort = (columnId: string) => {
    if (sortColumnId === columnId) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortColumnId(columnId);
      setSortDir("asc");
    }
    setShowSortMenu(false);
  };

  // ── Filter + sort items ──────────────────────────────────────────
  const getFilteredItems = (groupItems: ItemDef[]): ItemDef[] => {
    let filtered = groupItems;

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          Object.values(item.values).some(
            (v) =>
              v?.textValue?.toLowerCase().includes(q) ||
              (v?.jsonValue as { text?: string })?.text
                ?.toLowerCase()
                .includes(q)
          )
      );
    }

    // Column filters
    for (const filter of filters) {
      if (!filter.columnId) continue;
      if (!filter.value && filter.operator !== "is_empty" && filter.operator !== "is_not_empty") continue;
      filtered = filtered.filter((item) => {
        const cell = item.values[filter.columnId];
        if (!cell) return filter.operator === "is_empty";

        const col = board?.columns.find((c) => c.id === filter.columnId);
        if (!col) return true;

        const cellText =
          cell.textValue ||
          (cell.jsonValue as { text?: string })?.text ||
          cell.numberValue?.toString() ||
          "";

        switch (filter.operator) {
          case "equals":
            return cellText.toLowerCase() === filter.value.toLowerCase();
          case "contains":
            return cellText.toLowerCase().includes(filter.value.toLowerCase());
          case "not_equals":
            return cellText.toLowerCase() !== filter.value.toLowerCase();
          case "is_empty":
            return !cellText;
          case "is_not_empty":
            return !!cellText;
          default:
            return true;
        }
      });
    }

    // Sort
    if (sortColumnId) {
      filtered = [...filtered].sort((a, b) => {
        const av = a.values[sortColumnId];
        const bv = b.values[sortColumnId];
        const aStr = av?.textValue ?? (av?.jsonValue as { text?: string })?.text ?? av?.numberValue?.toString() ?? av?.dateValue ?? "";
        const bStr = bv?.textValue ?? (bv?.jsonValue as { text?: string })?.text ?? bv?.numberValue?.toString() ?? bv?.dateValue ?? "";
        return sortDir === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      });
    }

    return filtered;
  };

  // ── Render ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
      </div>
    );
  }

  if (!board) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Save error toast */}
      {saveError && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-4 py-3 bg-red-600 text-white text-sm font-medium rounded-xl shadow-lg animate-in slide-in-from-bottom-2">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {saveError}
          <button onClick={() => setSaveError(null)} className="ml-1 opacity-70 hover:opacity-100">✕</button>
        </div>
      )}
      {/* Board Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <Link href={`/dashboard/workspaces/${board.workspaceId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div
              className="w-2.5 h-7 rounded-full flex-shrink-0"
              style={{ backgroundColor: board.color }}
            />
            <h1 className="text-lg font-semibold text-gray-900">{board.name}</h1>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
          {/* View switcher */}
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
            {([["table", <Table2 key="t" className="h-3.5 w-3.5" />, "Table"], ["kanban", <KanbanSquare key="k" className="h-3.5 w-3.5" />, "Kanban"], ["gantt", <GanttChartSquare key="g" className="h-3.5 w-3.5" />, "Gantt"], ["calendar", <Calendar key="c" className="h-3.5 w-3.5" />, "Calendar"]] as [ViewMode, React.ReactNode, string][]).map(([mode, icon, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={cn("px-2.5 py-1 text-xs font-medium flex items-center gap-1 transition-colors",
                  viewMode === mode ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
                )}>{icon}{label}</button>
            ))}
          </div>

          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-600" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-8 h-7 text-xs border-gray-200 bg-gray-50 focus:bg-white"
            />
            {searchQuery && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-3 w-3 text-gray-600" />
              </button>
            )}
          </div>
          <button
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors",
              showFilters
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            )}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-3 w-3" />
            Filter
            {filters.length > 0 && (
              <span className="bg-blue-600 text-white text-[10px] rounded-full px-1.5 leading-4">
                {filters.length}
              </span>
            )}
          </button>

          {/* Sort */}
          <div className="relative">
            <button
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors",
                sortColumnId ? "bg-blue-50 border-blue-200 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
              onClick={() => setShowSortMenu(!showSortMenu)}
            >
              <ArrowUpDown className="h-3 w-3" />
              Sort{sortColumnId && ` (${board?.columns.find(c => c.id === sortColumnId)?.name ?? ""})`}
            </button>
            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowSortMenu(false)} />
                <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-xl ring-1 ring-gray-200 z-40 py-1">
                  <button className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 text-gray-500" onClick={() => { setSortColumnId(null); setShowSortMenu(false); }}>Clear sort</button>
                  <div className="border-t border-gray-100 my-1" />
                  {board?.columns.map(col => (
                    <button key={col.id} onClick={() => toggleSort(col.id)}
                      className={cn("w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50 flex items-center justify-between", sortColumnId === col.id && "text-blue-600 font-medium")}>
                      {col.name}
                      {sortColumnId === col.id && <span className="text-[10px]">{sortDir === "asc" ? "↑" : "↓"}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <button
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            onClick={addGroup}
          >
            <Plus className="h-3 w-3" />
            New Section
          </button>

          <div className="ml-auto flex items-center gap-2">
            <Link href={`/dashboard/boards/${boardId}/forms`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <FormInput className="h-3 w-3" />Forms
            </Link>
            <Link href={`/dashboard/boards/${boardId}/automations`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
              <Bot className="h-3 w-3" />Automations
            </Link>
            <button onClick={exportCSV} disabled={exporting}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
              {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}Export CSV
            </button>
            <button
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors",
                showBoardSettings
                  ? "bg-blue-50 border-blue-200 text-blue-700"
                  : "border-gray-200 text-gray-600 hover:bg-gray-50"
              )}
              onClick={() => setShowBoardSettings(!showBoardSettings)}
            >
              <Settings2 className="h-3 w-3" />
              Settings
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="px-6 pb-3">
            <FilterBar
              columns={board.columns}
              filters={filters}
              onChange={setFilters}
            />
          </div>
        )}
      </div>

      {/* Board Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {viewMode === "kanban" && (
          <KanbanView board={board} onUpdateCell={updateCell} onItemClick={(id) => setOpenItemId(id)} />
        )}
        {viewMode === "gantt" && (
          <GanttView board={board} />
        )}
        {viewMode === "calendar" && (
          <CalendarView board={board} />
        )}
        {viewMode === "table" && (
        <div className="px-6 py-4">
          {board.groups.map((group) => {
            const groupItems = board.items
              .filter((i) => i.groupId === group.id)
              .sort((a, b) => a.position - b.position);

            const filteredItems = getFilteredItems(groupItems);

            return (
              <BoardGroup
                key={group.id}
                group={group}
                columns={board.columns}
                items={filteredItems}
                allItemCount={groupItems.length}
                members={board.members}
                groups={board.groups}
                selectedItems={selectedItems}
                onToggleSelectItem={toggleSelectItem}
                onSelectAll={selectAll}
                onMoveColumn={moveColumn}
                onUpdateGroup={updateGroup}
                onDeleteGroup={deleteGroup}
                onAddItem={addItem}
                onUpdateItem={updateItem}
                onDeleteItem={deleteItem}
                onUpdateCell={updateCell}
                onAddColumn={addColumn}
                onDeleteColumn={deleteColumn}
                onUpdateColumn={updateColumn}
                onOpenItem={(id) => setOpenItemId(id)}
              />
            );
          })}
        </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedItems.size > 0 && (
        <>
          {bulkAction && (
            <div className="fixed inset-0 z-[79]" onClick={() => setBulkAction(null)} />
          )}
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] bg-white text-gray-900 rounded-xl shadow-2xl px-5 py-3 flex items-center gap-3 text-sm">
            <span className="font-medium tabular-nums">
              {selectedItems.size} task{selectedItems.size > 1 ? "s" : ""} selected
            </span>
            <div className="w-px h-5 bg-gray-600" />

            {/* Delete */}
            <button
              className="px-3 py-1 rounded-md hover:bg-gray-100 text-red-600 flex items-center gap-1.5 transition-colors"
              onClick={bulkDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>

            {/* Move to group */}
            <div className="relative">
              <button
                className={cn(
                  "px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors",
                  bulkAction === "move" ? "bg-gray-100" : "hover:bg-gray-100"
                )}
                onClick={() => setBulkAction(bulkAction === "move" ? null : "move")}
              >
                Move to
              </button>
              {bulkAction === "move" && (
                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white text-gray-900 rounded-lg shadow-xl ring-1 ring-gray-200 py-1">
                  {board.groups.map((g) => (
                    <button
                      key={g.id}
                      className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                      onClick={() => {
                        bulkMoveToGroup(g.id);
                        setBulkAction(null);
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: g.color }}
                      />
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Set Status */}
            {(() => {
              const statusCol = board.columns.find((c) => c.type === "status");
              if (!statusCol) return null;
              const statusLabels =
                (statusCol.config as { labels?: LabelConfig[] })?.labels || [];
              return (
                <div className="relative">
                  <button
                    className={cn(
                      "px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors",
                      bulkAction === "status" ? "bg-gray-100" : "hover:bg-gray-100"
                    )}
                    onClick={() =>
                      setBulkAction(bulkAction === "status" ? null : "status")
                    }
                  >
                    Status
                  </button>
                  {bulkAction === "status" && (
                    <div className="absolute bottom-full left-0 mb-2 w-44 bg-white text-gray-900 rounded-lg shadow-xl ring-1 ring-gray-200 py-1">
                      {statusLabels.map((label) => (
                        <button
                          key={label.id}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                          onClick={() => {
                            bulkUpdateCell(statusCol.id, {
                              jsonValue: {
                                id: label.id,
                                text: label.text,
                                color: label.color,
                              },
                            });
                            setBulkAction(null);
                          }}
                        >
                          <span
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: label.color }}
                          />
                          {label.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Set Priority */}
            {(() => {
              const priorityCol = board.columns.find((c) => c.type === "priority");
              if (!priorityCol) return null;
              const priorityLabels =
                (priorityCol.config as { labels?: LabelConfig[] })?.labels || [];
              return (
                <div className="relative">
                  <button
                    className={cn(
                      "px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors",
                      bulkAction === "priority" ? "bg-gray-100" : "hover:bg-gray-100"
                    )}
                    onClick={() =>
                      setBulkAction(bulkAction === "priority" ? null : "priority")
                    }
                  >
                    Priority
                  </button>
                  {bulkAction === "priority" && (
                    <div className="absolute bottom-full left-0 mb-2 w-44 bg-white text-gray-900 rounded-lg shadow-xl ring-1 ring-gray-200 py-1">
                      {priorityLabels.map((label) => (
                        <button
                          key={label.id}
                          className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2"
                          onClick={() => {
                            bulkUpdateCell(priorityCol.id, {
                              jsonValue: {
                                id: label.id,
                                text: label.text,
                                color: label.color,
                              },
                            });
                            setBulkAction(null);
                          }}
                        >
                          <span
                            className="w-3 h-3 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: label.color }}
                          />
                          {label.text}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Deselect */}
            <button
              className="p-1 rounded-md hover:bg-gray-100 transition-colors ml-1"
              onClick={() => setSelectedItems(new Set())}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </>
      )}

      {/* Item detail panel */}
      {openItemId && board && (
        <ItemDetailPanel
          itemId={openItemId}
          itemName={board.items.find((i) => i.id === openItemId)?.name ?? ""}
          boardId={boardId}
          currentUserId={(session?.user as { id?: string })?.id}
          startDate={board.items.find((i) => i.id === openItemId)?.startDate ?? null}
          endDate={board.items.find((i) => i.id === openItemId)?.endDate ?? null}
          onDatesChanged={fetchBoard}
          onClose={() => setOpenItemId(null)}
        />
      )}

      {/* Board settings panel */}
      {showBoardSettings && board && (
        <BoardSettingsPanel
          boardId={boardId}
          boardName={board.name}
          columns={board.columns}
          workspaceId={board.workspaceId}
          onClose={() => setShowBoardSettings(false)}
        />
      )}
    </div>
  );
}
