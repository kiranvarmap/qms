"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, Check, Loader2, Trash2, Bot, Mail, Zap, FileText, AtSign, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Notification {
  id: string; type: string; title: string; body: string | null;
  boardId: string | null; itemId: string | null; isRead: boolean; createdAt: string;
}

function formatRelative(dateStr: string) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function isToday(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function getTypeStyle(type: string): { icon: React.ReactNode; bg: string; text: string } {
  switch (type) {
    case "automation": return { icon: <Bot className="h-3.5 w-3.5" />,      bg: "bg-violet-100", text: "text-violet-600" };
    case "email":      return { icon: <Mail className="h-3.5 w-3.5" />,     bg: "bg-blue-100",   text: "text-blue-600"   };
    case "mention":    return { icon: <AtSign className="h-3.5 w-3.5" />,   bg: "bg-pink-100",   text: "text-pink-600"   };
    case "form":       return { icon: <FileText className="h-3.5 w-3.5" />, bg: "bg-teal-100",   text: "text-teal-600"   };
    case "status":     return { icon: <Zap className="h-3.5 w-3.5" />,      bg: "bg-amber-100",  text: "text-amber-600"  };
    default:           return { icon: <Info className="h-3.5 w-3.5" />,     bg: "bg-gray-100",   text: "text-gray-500"   };
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setNotifications(await res.json());
    } finally { setLoading(false); }
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    setNotifications(p => p.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", { method: "POST" });
    setNotifications(p => p.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: "DELETE" });
    setNotifications(p => p.filter(n => n.id !== id));
  };

  const getHref = (n: Notification) => {
    if (n.boardId) return `/dashboard/boards/${n.boardId}`;
    return "/dashboard";
  };

  const todayNotes  = notifications.filter(n =>  isToday(n.createdAt));
  const olderNotes  = notifications.filter(n => !isToday(n.createdAt));

  const renderNote = (n: Notification) => {
    const style = getTypeStyle(n.type);
    return (
      <div key={n.id} className={cn("flex items-start gap-3 px-4 py-3 hover:bg-gray-50/80 group border-b border-gray-50 last:border-0 transition-colors", !n.isRead && "bg-blue-50/40")}>
        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5", style.bg, style.text)}>
          {style.icon}
        </div>
        <Link href={getHref(n)} onClick={() => { markRead(n.id); setOpen(false); }} className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className={cn("text-xs font-semibold text-gray-900 leading-snug line-clamp-2", n.isRead && "font-medium text-gray-700")}>{n.title}</p>
            {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
          </div>
          {n.body && <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2 leading-relaxed">{n.body}</p>}
          <p className="text-[10px] text-gray-300 mt-1">{formatRelative(n.createdAt)}</p>
        </Link>
        <button onClick={() => deleteNotification(n.id)}
          className="hidden group-hover:flex p-1 rounded hover:bg-gray-200 text-gray-300 hover:text-gray-500 flex-shrink-0 transition-colors">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  };

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(!open)}
        className="relative flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] font-medium rounded-md text-gray-400 hover:bg-white/5 hover:text-gray-200 transition-colors w-full">
        <Bell className="h-4 w-4 flex-shrink-0" />
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span className="ml-auto bg-blue-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-2xl shadow-2xl shadow-black/10 ring-1 ring-gray-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-bold text-gray-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 transition-colors">
                <Check className="h-3 w-3" />All read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                <p className="text-xs text-gray-400">Loading…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Bell className="h-6 w-6 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">You are all caught up!</p>
                <p className="text-xs text-gray-400 mt-0.5">No new notifications</p>
              </div>
            ) : (
              <>
                {todayNotes.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-gray-50/40 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Today</p>
                    </div>
                    {todayNotes.map(renderNote)}
                  </>
                )}
                {olderNotes.length > 0 && (
                  <>
                    <div className="px-4 py-2 bg-gray-50/40 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Earlier</p>
                    </div>
                    {olderNotes.map(renderNote)}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
