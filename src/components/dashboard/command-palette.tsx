"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";

interface Hit { type: string; id: string; title: string; subtitle: string | null; href: string }
interface Workspace { id: string; name: string }

/** Global ⌘K / Ctrl-K search palette (blueprint 07 §4). */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [workspaceId, setWorkspaceId] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the workspace once (first workspace; pages keep their own pickers).
  useEffect(() => {
    fetch("/api/workspaces").then((r) => r.json()).then((d: Workspace[]) => {
      if (Array.isArray(d) && d.length > 0) setWorkspaceId(d[0].id);
    }).catch(() => {});
  }, []);

  // Keyboard: ⌘K / Ctrl-K toggles, Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else { setQ(""); setHits([]); setActive(0); }
  }, [open]);

  const search = useCallback((term: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      if (!workspaceId || term.trim().length < 2) { setHits([]); return; }
      const res = await fetch(`/api/search?workspaceId=${workspaceId}&q=${encodeURIComponent(term.trim())}`);
      const d = await res.json().catch(() => ({ hits: [] }));
      setHits(res.ok && Array.isArray(d.hits) ? d.hits : []);
      setActive(0);
    }, 180);
  }, [workspaceId]);

  const go = (hit: Hit) => {
    setOpen(false);
    router.push(hit.href);
  };

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]); }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-start justify-center pt-[12vh]" onClick={() => setOpen(false)}>
      <div className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 px-4 border-b border-gray-100">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); search(e.target.value); }}
            onKeyDown={onInputKey}
            placeholder="Search customers, invoices, products, assets…"
            className="flex-1 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none"
          />
          <kbd className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {q.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Type at least 2 characters…</div>
          ) : hits.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No matches.</div>
          ) : hits.map((h, i) => (
            <button
              key={`${h.type}-${h.id}`}
              onClick={() => go(h)}
              onMouseEnter={() => setActive(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${i === active ? "bg-blue-50" : ""}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-24 shrink-0">{h.type}</span>
              <span className="text-sm text-gray-900 truncate">{h.title}</span>
              {h.subtitle && <span className="text-xs text-gray-400 truncate">{h.subtitle}</span>}
              {i === active && <CornerDownLeft className="h-3.5 w-3.5 text-gray-400 ml-auto shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
