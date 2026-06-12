"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bookmark, Add as Plus, Delete as Trash2, Group as Users } from "@vibe/icons";
import { cn } from "@/lib/utils";

export interface SavedViewConfig {
  viewMode?: string;
  filters?: unknown[];
  sortColumnId?: string | null;
  sortDir?: string;
  searchQuery?: string;
}

interface SavedView { id: string; name: string; isShared: boolean; userId: string; config: SavedViewConfig }

/** Saved-views dropdown for the board toolbar (audit P4). */
export function SavedViewsMenu({
  boardId,
  getConfig,
  onApply,
}: {
  boardId: string;
  getConfig: () => SavedViewConfig;
  onApply: (config: SavedViewConfig) => void;
}) {
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState<SavedView[]>([]);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/boards/${boardId}/views`);
    const d = await res.json().catch(() => ({}));
    setViews(res.ok && Array.isArray(d.data) ? d.data : []);
  }, [boardId]);

  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const saveCurrent = async (shared: boolean) => {
    const name = window.prompt(shared ? "Name this shared view" : "Name this view");
    if (!name?.trim()) return;
    setSaving(true);
    await fetch(`/api/boards/${boardId}/views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), config: getConfig(), isShared: shared }),
    });
    setSaving(false);
    load();
  };

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch(`/api/views/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "px-2.5 py-1 text-xs font-medium flex items-center gap-1 border border-gray-200 rounded-md transition-colors",
          open ? "bg-blue-600 text-white border-blue-600" : "text-gray-600 hover:bg-gray-50"
        )}
      >
        <Bookmark className="h-3.5 w-3.5" /> Views{views.length > 0 ? ` (${views.length})` : ""}
      </button>
      {open && (
        <div className="absolute z-40 mt-1.5 w-64 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-y-auto">
            {views.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-400">No saved views yet.</div>
            ) : views.map((v) => (
              <button
                key={v.id}
                onClick={() => { onApply(v.config); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50"
              >
                <span className="text-sm text-gray-900 truncate">{v.name}</span>
                {v.isShared && <Users className="h-3 w-3 text-gray-400 shrink-0" />}
                <span onClick={(e) => remove(v.id, e)} className="ml-auto text-gray-300 hover:text-red-600 shrink-0" title="Delete view">
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100">
            <button onClick={() => saveCurrent(false)} disabled={saving} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50">
              <Plus className="h-3.5 w-3.5" /> Save current view
            </button>
            <button onClick={() => saveCurrent(true)} disabled={saving} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50">
              <Users className="h-3.5 w-3.5" /> Save & share with workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
