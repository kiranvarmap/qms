"use client";

import { useState, useRef } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  MoreHorizontal,
  Settings2,
  Maximize2,
} from "lucide-react";
import type {
  GroupDef,
  ColumnDef,
  ItemDef,
  BoardMember,
  CellValue,
} from "@/lib/types";
import { CellRenderer } from "@/components/board/cell-renderer";
import { AddColumnMenu } from "@/components/board/add-column-menu";
import { EditOptionsModal } from "@/components/board/edit-options-modal";
import type { LabelConfig } from "@/lib/types";

interface BoardGroupProps {
  group: GroupDef;
  columns: ColumnDef[];
  items: ItemDef[];
  allItemCount: number;
  members: BoardMember[];
  groups: GroupDef[];
  selectedItems: Set<string>;
  onToggleSelectItem: (itemId: string) => void;
  onSelectAll: (itemIds: string[], select: boolean) => void;
  onMoveColumn: (columnId: string, direction: 'left' | 'right') => void;
  onUpdateGroup: (groupId: string, updates: Partial<GroupDef>) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onAddItem: (groupId: string, name: string) => Promise<void>;
  onUpdateItem: (itemId: string, updates: Partial<ItemDef>) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
  onUpdateCell: (
    itemId: string,
    columnId: string,
    value: Partial<CellValue>
  ) => Promise<void>;
  onAddColumn: (name: string, type: string) => Promise<void>;
  onDeleteColumn: (columnId: string) => Promise<void>;
  onUpdateColumn: (columnId: string, updates: Partial<ColumnDef>) => Promise<void>;
  onOpenItem?: (itemId: string) => void;
  labelConfig?: LabelConfig;
}

const SECTION_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export function BoardGroup({
  group,
  columns,
  items,
  allItemCount,
  members,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  groups: _groups,
  selectedItems,
  onToggleSelectItem,
  onSelectAll,
  onMoveColumn,
  onUpdateGroup,
  onDeleteGroup,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onUpdateCell,
  onAddColumn,
  onDeleteColumn,
  onUpdateColumn,
  onOpenItem,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  labelConfig: _labelConfig,
}: BoardGroupProps) {
  const [collapsed, setCollapsed] = useState(group.collapsed);
  const [editingName, setEditingName] = useState(false);
  const [groupName, setGroupName] = useState(group.name);
  const [newItemName, setNewItemName] = useState("");
  const [showNewItemInput, setShowNewItemInput] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState("");
  const [colMenuId, setColMenuId] = useState<string | null>(null);
  const [editingOptionsCol, setEditingOptionsCol] = useState<ColumnDef | null>(null);
  const [colMenuPos, setColMenuPos] = useState({ top: 0, left: 0 });
  const newItemRef = useRef<HTMLInputElement>(null);

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    onUpdateGroup(group.id, { collapsed: next });
  };

  const handleGroupRename = () => {
    if (groupName.trim() && groupName !== group.name) {
      onUpdateGroup(group.id, { name: groupName.trim() });
    }
    setEditingName(false);
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) return;
    await onAddItem(group.id, newItemName.trim());
    setNewItemName("");
    setTimeout(() => newItemRef.current?.focus(), 50);
  };

  const handleItemRename = (itemId: string) => {
    if (editItemName.trim()) {
      onUpdateItem(itemId, { name: editItemName.trim() });
    }
    setEditingItemId(null);
  };

  const handleSaveOptions = (columnId: string, labels: LabelConfig[]) => {
    onUpdateColumn(columnId, { config: { labels } } as Partial<ColumnDef>);
  };

  const handleAddOption = (columnId: string, label: LabelConfig) => {
    const col = columns.find((c) => c.id === columnId);
    if (!col) return;
    const existing = (col.config as { labels?: LabelConfig[] })?.labels || [];
    onUpdateColumn(columnId, { config: { labels: [...existing, label] } } as Partial<ColumnDef>);
  };

  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
  const allSelected = items.length > 0 && items.every((i) => selectedItems.has(i.id));
  const someSelected = items.some((i) => selectedItems.has(i.id));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_rowMenuId, _setRowMenuId] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_rowMenuPos, _setRowMenuPos] = useState({ top: 0, left: 0 });

  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center gap-1 group/header mb-0.5">
        <button
          onClick={toggleCollapse}
          className="p-1 rounded hover:bg-gray-100 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {editingName ? (
          <input
            className="text-sm font-semibold border-b-2 outline-none bg-transparent px-1 py-0.5"
            style={{ borderColor: group.color, color: group.color }}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onBlur={handleGroupRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleGroupRename();
              if (e.key === "Escape") {
                setGroupName(group.name);
                setEditingName(false);
              }
            }}
            autoFocus
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-sm font-semibold hover:opacity-80 transition-opacity px-1 py-0.5"
            style={{ color: group.color }}
          >
            {group.name}
          </button>
        )}

        <span className="text-[11px] text-gray-400 tabular-nums">
          {allItemCount}
        </span>

        {/* Section menu */}
        <div className="relative">
          <button
            className="p-1 rounded hover:bg-gray-100 opacity-0 group-hover/header:opacity-100 transition-opacity"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <MoreHorizontal className="h-3.5 w-3.5 text-gray-400" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute left-0 z-20 mt-1 w-44 rounded-lg bg-white shadow-xl ring-1 ring-gray-200 py-1">
                <p className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  Section Color
                </p>
                <div className="flex gap-1.5 px-3 py-1 flex-wrap">
                  {SECTION_COLORS.map((c) => (
                    <button
                      key={c}
                      className={`w-5 h-5 rounded-full transition-all ${
                        group.color === c
                          ? "ring-2 ring-offset-1 ring-gray-400 scale-110"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => {
                        onUpdateGroup(group.id, { color: c });
                        setMenuOpen(false);
                      }}
                    />
                  ))}
                </div>
                <hr className="my-1" />
                <button
                  className="w-full px-3 py-1.5 text-left text-[13px] hover:bg-gray-50 text-red-500 flex items-center gap-2"
                  onClick={() => {
                    onDeleteGroup(group.id);
                    setMenuOpen(false);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete section
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      {!collapsed && (
        <div className="overflow-x-auto">
          <div className="inline-flex flex-col min-w-full">
            {/* Column headers */}
            <div className="flex items-stretch border-b border-gray-200 text-[11px] font-medium text-gray-500 uppercase tracking-wider">
              {/* Frozen: delete spacer + task name */}
              <div className="sticky left-0 z-[5] bg-white flex items-stretch flex-shrink-0">
                <div className="w-8 flex-shrink-0 flex items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={() => onSelectAll(items.map((i) => i.id), !allSelected)}
                  />
                </div>
                <div className="w-7 flex-shrink-0" />
                <div className="w-[260px] pl-1 pr-3 py-2 border-r border-gray-200">Task name</div>
              </div>
              {/* Scrollable columns */}
              {sortedColumns.map((col, colIdx) => (
                <div
                  key={col.id}
                  className="flex-shrink-0 px-2 py-2 text-center relative group/col border-l border-gray-100"
                  style={{ width: col.width }}
                >
                  <span className="truncate block">{col.name}</span>
                  <button
                    className="absolute top-1/2 -translate-y-1/2 right-0.5 p-0.5 rounded hover:bg-gray-200 opacity-0 group-hover/col:opacity-100 transition-opacity"
                    onClick={(e) => {
                      if (colMenuId === col.id) { setColMenuId(null); return; }
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      setColMenuPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 190) });
                      setColMenuId(col.id);
                    }}
                  >
                    <MoreHorizontal className="h-3 w-3" />
                  </button>
                  {colMenuId === col.id && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => setColMenuId(null)} />
                      <div
                        className="fixed z-[70] w-44 rounded-lg bg-white shadow-xl ring-1 ring-gray-200 py-1 text-left normal-case tracking-normal"
                        style={{ top: colMenuPos.top, left: colMenuPos.left }}
                      >
                        <button
                          className="w-full px-3 py-1.5 text-[13px] hover:bg-gray-50 text-gray-700 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                          disabled={colIdx === 0}
                          onClick={() => { onMoveColumn(col.id, 'left'); setColMenuId(null); }}
                        >
                          ← Move left
                        </button>
                        <button
                          className="w-full px-3 py-1.5 text-[13px] hover:bg-gray-50 text-gray-700 flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                          disabled={colIdx === sortedColumns.length - 1}
                          onClick={() => { onMoveColumn(col.id, 'right'); setColMenuId(null); }}
                        >
                          → Move right
                        </button>
                        {["status", "priority", "dropdown"].includes(col.type) && (
                          <>
                            <hr className="my-1" />
                            <button
                              className="w-full px-3 py-1.5 text-[13px] hover:bg-gray-50 text-gray-700 flex items-center gap-2"
                              onClick={() => {
                                setEditingOptionsCol(col);
                                setColMenuId(null);
                              }}
                            >
                              <Settings2 className="h-3.5 w-3.5" />
                              Edit options
                            </button>
                          </>
                        )}
                        <hr className="my-1" />
                        <button
                          className="w-full px-3 py-1.5 text-[13px] hover:bg-gray-50 text-red-500 flex items-center gap-2"
                          onClick={() => {
                            onDeleteColumn(col.id);
                            setColMenuId(null);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete column
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              <div className="w-10 flex-shrink-0 flex items-center justify-center border-l border-gray-100">
                <AddColumnMenu onAdd={onAddColumn} />
              </div>
            </div>

            {/* Rows */}
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-stretch border-b border-gray-100 hover:bg-gray-50/80 transition-colors group/row"
              >
                {/* Frozen: delete + task name */}
                <div className="sticky left-0 z-[4] bg-inherit flex items-stretch flex-shrink-0 group-hover/row:bg-gray-50/80">
                  <div className="w-8 flex-shrink-0 flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 cursor-pointer accent-blue-600"
                      checked={selectedItems.has(item.id)}
                      onChange={() => onToggleSelectItem(item.id)}
                    />
                  </div>
                  <div className="w-7 flex-shrink-0 flex items-center justify-center">
                    <button
                      className="p-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity rounded hover:bg-red-50"
                      onClick={() => onDeleteItem(item.id)}
                      title="Delete task"
                    >
                      <Trash2 className="h-3 w-3 text-gray-300 hover:text-red-500" />
                    </button>
                  </div>
                  <div className="w-[260px] pl-1 pr-3 py-[5px] border-r border-gray-200">
                    {editingItemId === item.id ? (
                      <input
                        className="w-full text-[13px] border-b border-blue-400 outline-none bg-transparent py-0.5 text-gray-900"
                        value={editItemName}
                        onChange={(e) => setEditItemName(e.target.value)}
                        onBlur={() => handleItemRename(item.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleItemRename(item.id);
                          if (e.key === "Escape") setEditingItemId(null);
                        }}
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-1 group/name">
                        <button
                          className="text-[13px] text-gray-900 hover:text-blue-600 text-left flex-1 truncate py-0.5"
                          onDoubleClick={() => {
                            setEditingItemId(item.id);
                            setEditItemName(item.name);
                          }}
                        >
                          {item.name}
                        </button>
                        {onOpenItem && (
                          <button
                            onClick={() => onOpenItem(item.id)}
                            title="Open details"
                            className="opacity-0 group-hover/name:opacity-100 p-0.5 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-opacity flex-shrink-0"
                          >
                            <Maximize2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row context menu button */}
                {/* Scrollable cell values */}
                {sortedColumns.map((col) => (
                  <div
                    key={col.id}
                    className="flex-shrink-0 px-1 py-[3px] border-l border-gray-100"
                    style={{ width: col.width }}
                  >
                    <CellRenderer
                      column={col}
                      value={item.values[col.id]}
                      members={members}
                      onChange={(value) => onUpdateCell(item.id, col.id, value)}
                      onAddOption={handleAddOption}
                    />
                  </div>
                ))}

                <div className="w-10 flex-shrink-0" />
              </div>
            ))}

            {/* Add task row */}
            <div className="flex items-stretch">
              <div className="sticky left-0 z-[4] bg-white flex items-stretch flex-shrink-0">
                <div className="w-8 flex-shrink-0" />
                <div className="w-7 flex-shrink-0" />
                <div className="w-[260px] pl-1 py-1 border-r border-gray-200">
                  {showNewItemInput ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddItem();
                      }}
                      className="flex items-center"
                    >
                      <input
                        ref={newItemRef}
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Write a task name and press Enter"
                        className="w-full text-[13px] outline-none bg-transparent py-1 text-gray-600 placeholder:text-gray-400"
                        autoFocus
                        onBlur={() => {
                          if (!newItemName.trim()) setShowNewItemInput(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            setNewItemName("");
                            setShowNewItemInput(false);
                          }
                        }}
                      />
                    </form>
                  ) : (
                    <button
                      className="text-[13px] text-gray-400 hover:text-gray-600 flex items-center gap-1.5 py-1 transition-colors"
                      onClick={() => setShowNewItemInput(true)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add task
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Options Modal */}
      {editingOptionsCol && (
        <EditOptionsModal
          column={editingOptionsCol}
          onSave={handleSaveOptions}
          onClose={() => setEditingOptionsCol(null)}
        />
      )}
    </div>
  );
}
