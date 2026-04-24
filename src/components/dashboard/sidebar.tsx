"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

function handleSignOut() {
  signOut({ redirect: false }).then(() => {
    window.location.href = "/api/auth/logout";
  });
}
import { cn } from "@/lib/utils";
import { useEffect, useState, useCallback } from "react";
import {
  LayoutDashboard,
  Users,
  LogOut,
  Shield,
  ChevronDown,
  ChevronRight,
  Plus,
  ClipboardList,
  Clock,
  UserCog,
  Hammer,
  FolderKanban,
  BarChart3,
  FileSignature,
  Settings2,
} from "lucide-react";
import { NotificationBell } from "./notification-bell";

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
}

interface Workspace {
  id: string;
  name: string;
  color: string;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [expandedWs, setExpandedWs] = useState<Record<string, boolean>>({});
  const [wsBoards, setWsBoards] = useState<
    Record<string, Array<{ id: string; name: string; color: string }>>
  >({});

  const loadBoards = useCallback(async (wsId: string) => {
    if (wsBoards[wsId]) return;
    try {
      const res = await fetch(`/api/workspaces/${wsId}`);
      const data = await res.json();
      setWsBoards((prev) => ({ ...prev, [wsId]: data.boards || [] }));
    } catch {
      /* ignore */
    }
  }, [wsBoards]);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        setWorkspaces(data);
        // Auto-expand the workspace if we're on a workspace/board page
        for (const ws of data) {
          if (pathname.includes(ws.id)) {
            setExpandedWs((prev) => ({ ...prev, [ws.id]: true }));
            loadBoards(ws.id);
          }
        }
      })
      .catch(() => {});
  }, [pathname, loadBoards]);

  const toggleWorkspace = (wsId: string) => {
    const next = !expandedWs[wsId];
    setExpandedWs((prev) => ({ ...prev, [wsId]: next }));
    if (next) loadBoards(wsId);
  };

  const navItems = [
    { name: "Home", href: "/dashboard", icon: LayoutDashboard },
    { name: "Inspections", href: "/dashboard/inspections", icon: ClipboardList },
  ];

  const empNavItems = [
    { name: "Time Clock", href: "/dashboard/time-clock", icon: Clock },
    ...(user.role === "admin" || user.role === "manager"
      ? [
          { name: "Employees", href: "/dashboard/employees", icon: UserCog },
          { name: "Workshops", href: "/dashboard/emp-workshops", icon: Hammer },
          { name: "Projects & Tasks", href: "/dashboard/emp-projects", icon: FolderKanban },
          { name: "EMP Reports", href: "/dashboard/emp-reports", icon: BarChart3 },
        ]
      : []),
  ];

  const signNavItems = [
    { name: "Documents", href: "/dashboard/sign", icon: FileSignature },
  ];

  const adminNavItems = user.role === "admin"
    ? [{ name: "Users", href: "/dashboard/users", icon: Users }]
    : [];

  return (
    <aside className="w-[240px] flex-shrink-0 bg-gray-950 text-gray-300 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-white/10 flex-shrink-0">
        <Shield className="h-6 w-6 text-blue-400" />
        <span className="font-semibold text-white text-base tracking-tight">QMS</span>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] font-medium rounded-md transition-colors",
                isActive
                  ? "bg-white/10 text-white"
                  : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.name}
            </Link>
          );
        })}

        {/* Employee Management section */}
        <div className="pt-4">
          <div className="px-2.5 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Employee Management
            </span>
          </div>
          {empNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* DocSign section */}
        <div className="pt-4">
          <div className="px-2.5 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Document Signing
            </span>
          </div>
          {signNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Admin nav */}
        {adminNavItems.length > 0 && (
          <div className="pt-4">
            <div className="px-2.5 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Admin
              </span>
            </div>
            {adminNavItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] font-medium rounded-md transition-colors",
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}

        {/* Workspaces section */}
        <div className="pt-5">
          <div className="flex items-center justify-between px-2.5 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              Workspaces
            </span>
            <Link
              href="/dashboard/workspaces"
              className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors"
              title="All workspaces"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="space-y-0.5">
            {workspaces.map((ws) => (
              <div key={ws.id}>
                <button
                  onClick={() => toggleWorkspace(ws.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2.5 py-[7px] text-[13px] font-medium rounded-md transition-colors",
                    pathname.includes(ws.id)
                      ? "bg-white/10 text-white"
                      : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  )}
                >
                  {expandedWs[ws.id] ? (
                    <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-500" />
                  ) : (
                    <ChevronRight className="h-3 w-3 flex-shrink-0 text-gray-500" />
                  )}
                  <span
                    className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white"
                    style={{ backgroundColor: ws.color }}
                  >
                    {ws.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{ws.name}</span>
                </button>

                {/* Boards under workspace */}
                {expandedWs[ws.id] && wsBoards[ws.id] && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {wsBoards[ws.id].map((board) => {
                      const isBoardActive = pathname.includes(board.id);
                      return (
                        <Link
                          key={board.id}
                          href={`/dashboard/boards/${board.id}`}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-[6px] text-[13px] rounded-md transition-colors",
                            isBoardActive
                              ? "bg-white/10 text-white"
                              : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                          )}
                        >
                          <span
                            className="w-2 h-2 rounded-sm flex-shrink-0"
                            style={{ backgroundColor: board.color }}
                          />
                          <span className="truncate">{board.name}</span>
                        </Link>
                      );
                    })}
                    {/* Workspace settings link */}
                    <Link
                      href={`/dashboard/workspaces/${ws.id}/settings`}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-[6px] text-[13px] rounded-md transition-colors",
                        pathname === `/dashboard/workspaces/${ws.id}/settings`
                          ? "bg-white/10 text-white"
                          : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                      )}
                    >
                      <Settings2 className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">Settings</span>
                    </Link>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Footer / User */}
      <div className="border-t border-white/10 px-3 py-3 flex-shrink-0">
        <NotificationBell />
        <Link
          href="/dashboard/profile"
          className={cn(
            "flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] font-medium rounded-md transition-colors",
            pathname === "/dashboard/profile"
              ? "bg-white/10 text-white"
              : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
          )}
        >
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <span className="truncate block">{user.name || user.email}</span>
          </div>
        </Link>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] font-medium rounded-md text-gray-500 hover:bg-white/5 hover:text-gray-300 transition-colors w-full mt-0.5"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
