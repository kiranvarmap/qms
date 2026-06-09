"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
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
  GitBranch,
  CalendarRange,
  Gauge,
  AlertTriangle,
  Building2,
  Inbox,
  ShoppingCart,
  Boxes,
  FileText,
  Receipt,
  Users2,
  Wallet,
  CalendarDays,
  GraduationCap,
  Briefcase,
  Truck,
  Warehouse,
  Package,
  Factory,
  Wrench,
  ShieldAlert,
  Globe,
  MapPin,
  ClipboardCheck,
  DollarSign,
  Tags,
  Repeat,
  Undo2,
  FileMinus,
  ReceiptText,
  BookOpen,
  BookText,
  ScrollText,
  Banknote,
  CreditCard,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { NotificationBell } from "./notification-bell";

function handleSignOut() {
  signOut({ callbackUrl: "/auth/signin" });
}

interface SidebarProps {
  user: { name?: string | null; email?: string | null; role?: string };
}

interface Workspace { id: string; name: string; color: string }

interface NavLink { name: string; href: string; icon: LucideIcon }
interface NavGroup { id: string; label: string; icon: LucideIcon; items: NavLink[] }

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const mgr = user.role === "admin" || user.role === "manager";
  const admin = user.role === "admin";

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [expandedWs, setExpandedWs] = useState<Record<string, boolean>>({});
  const [wsBoards, setWsBoards] = useState<Record<string, Array<{ id: string; name: string; color: string }>>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const loadBoards = useCallback(async (wsId: string) => {
    if (wsBoards[wsId]) return;
    try {
      const res = await fetch(`/api/workspaces/${wsId}`);
      const data = await res.json();
      setWsBoards((prev) => ({ ...prev, [wsId]: data.boards || [] }));
    } catch { /* ignore */ }
  }, [wsBoards]);

  useEffect(() => {
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((data) => {
        setWorkspaces(data);
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

  // ── Active-path helpers ────────────────────────────────────────────
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  // ── Top-level links (always visible) ───────────────────────────────
  const topLinks: NavLink[] = [
    { name: "Home", href: "/dashboard", icon: LayoutDashboard },
    { name: "Approvals", href: "/dashboard/approvals", icon: Inbox },
    ...(mgr ? [{ name: "Reports", href: "/dashboard/reports", icon: BarChart3 }] : []),
  ];

  // ── Grouped, collapsible sections ──────────────────────────────────
  const groups: NavGroup[] = [
    ...(mgr ? [{
      id: "sales", label: "Sales", icon: Briefcase, items: [
        { name: "Customers", href: "/dashboard/customers", icon: Users2 },
        { name: "Estimates", href: "/dashboard/estimates", icon: FileText },
        { name: "Sales Orders", href: "/dashboard/sales-orders", icon: ClipboardList },
        { name: "Returns / RMA", href: "/dashboard/sales-orders/returns", icon: Undo2 },
        { name: "Price Lists", href: "/dashboard/sales-orders/price-lists", icon: Tags },
        { name: "Recurring", href: "/dashboard/sales-orders/recurring", icon: Repeat },
        { name: "Invoices", href: "/dashboard/invoices", icon: Receipt },
      ],
    }] : []),
    ...(mgr ? [{
      id: "procurement", label: "Procurement", icon: Truck, items: [
        { name: "Vendors", href: "/dashboard/vendors", icon: Building2 },
        { name: "Requisitions", href: "/dashboard/purchase-orders/requisitions", icon: ClipboardList },
        { name: "Purchase Orders", href: "/dashboard/purchase-orders", icon: ShoppingCart },
        { name: "Returns / Debit Notes", href: "/dashboard/purchase-orders/returns", icon: Truck },
      ],
    }] : []),
    ...(mgr ? [{
      id: "inventory", label: "Inventory", icon: Boxes, items: [
        { name: "Product Mgmt", href: "/dashboard/products", icon: Package },
        { name: "Stock", href: "/dashboard/inventory", icon: Boxes },
        { name: "Warehouses", href: "/dashboard/inventory/warehouses", icon: Warehouse },
        { name: "Locations", href: "/dashboard/inventory/locations", icon: MapPin },
        { name: "Lots / Batches", href: "/dashboard/inventory/lots", icon: Boxes },
        { name: "Cycle Counts", href: "/dashboard/inventory/cycle-counts", icon: ClipboardCheck },
        { name: "Damaged / Scrap", href: "/dashboard/inventory/stock-status", icon: Warehouse },
        { name: "Valuation", href: "/dashboard/inventory/valuation", icon: DollarSign },
      ],
    }] : []),
    ...(mgr ? [{
      id: "production", label: "Production", icon: Factory, items: [
        { name: "Work Orders", href: "/dashboard/production", icon: Factory },
        { name: "Process Templates", href: "/dashboard/production-planning/templates", icon: GitBranch },
        { name: "Work Centers", href: "/dashboard/production-planning/work-centers", icon: Factory },
        { name: "Skills", href: "/dashboard/production-planning/skills", icon: Wrench },
        { name: "Timeline", href: "/dashboard/production-planning/timeline", icon: CalendarRange },
        { name: "Capacity", href: "/dashboard/production-planning/capacity", icon: Gauge },
        { name: "Bottlenecks", href: "/dashboard/production-planning/bottlenecks", icon: AlertTriangle },
        { name: "Material Needs", href: "/dashboard/production-planning/materials", icon: Boxes },
      ],
    }] : []),
    ...(mgr ? [{
      id: "maintenance", label: "Maintenance", icon: Wrench, items: [
        { name: "Work Orders", href: "/dashboard/maintenance", icon: Wrench },
        { name: "Assets", href: "/dashboard/maintenance/assets", icon: Boxes },
      ],
    }] : []),
    ...(mgr ? [{
      id: "finance", label: "Finance", icon: Wallet, items: [
        { name: "Expenses", href: "/dashboard/expenses", icon: Wallet },
        { name: "Cash Advances", href: "/dashboard/expenses/advances", icon: Banknote },
        { name: "Card Import", href: "/dashboard/expenses/card-import", icon: CreditCard },
        { name: "Expense Policies", href: "/dashboard/expenses/policies", icon: ShieldCheck },
        { name: "AP Bills", href: "/dashboard/invoices/ap-bills", icon: FileMinus },
        { name: "Credit Notes", href: "/dashboard/invoices/credit-notes", icon: ReceiptText },
        { name: "Reports", href: "/dashboard/reports", icon: BarChart3 },
      ],
    }] : []),
    ...(mgr ? [{
      id: "books", label: "Books", icon: BookOpen, items: [
        { name: "Chart of Accounts", href: "/dashboard/books/accounts", icon: BookOpen },
        { name: "Journal", href: "/dashboard/books/journal", icon: BookText },
        { name: "Trial Balance", href: "/dashboard/books/trial-balance", icon: ScrollText },
      ],
    }] : []),
    {
      id: "people", label: "People", icon: Users, items: [
        { name: "Time Clock", href: "/dashboard/time-clock", icon: Clock },
        ...(mgr ? [
          { name: "Employees", href: "/dashboard/employees", icon: UserCog },
          { name: "HR Directory", href: "/dashboard/hr", icon: UserCog },
          { name: "Leave", href: "/dashboard/leave", icon: CalendarDays },
          { name: "Training", href: "/dashboard/training", icon: GraduationCap },
        ] : []),
      ],
    },
    {
      id: "quality", label: "Quality & Docs", icon: ClipboardList, items: [
        { name: "Inspections", href: "/dashboard/inspections", icon: ClipboardList },
        { name: "Safety", href: "/dashboard/safety", icon: ShieldAlert },
        { name: "Documents", href: "/dashboard/sign", icon: FileSignature },
      ],
    },
    ...(mgr ? [{
      id: "projects", label: "Projects & Time", icon: FolderKanban, items: [
        { name: "Workshops", href: "/dashboard/emp-workshops", icon: Hammer },
        { name: "Projects & Tasks", href: "/dashboard/emp-projects", icon: FolderKanban },
        { name: "Work Time", href: "/dashboard/work-time", icon: Clock },
        { name: "EMP Reports", href: "/dashboard/emp-reports", icon: BarChart3 },
      ],
    }] : []),
    ...(admin ? [{
      id: "admin", label: "Admin", icon: Shield, items: [
        { name: "Users", href: "/dashboard/users", icon: Users },
        { name: "Localization", href: "/dashboard/settings/localization", icon: Globe },
      ],
    }] : []),
  ];

  const groupOpen = (g: NavGroup) => openGroups[g.id] ?? g.items.some((i) => isActive(i.href));

  return (
    <aside className="w-[240px] flex-shrink-0 bg-gray-950 text-gray-300 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-white/10 flex-shrink-0">
        <Shield className="h-6 w-6 text-blue-400" />
        <span className="font-semibold text-white text-base tracking-tight">QMS</span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {/* Top-level links */}
        {topLinks.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] font-medium rounded-md transition-colors",
              isActive(item.href) ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
            )}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.name}
          </Link>
        ))}

        {/* Collapsible groups */}
        <div className="pt-2 space-y-0.5">
          {groups.map((g) => {
            const open = groupOpen(g);
            const hasActive = g.items.some((i) => isActive(i.href));
            return (
              <div key={g.id}>
                <button
                  onClick={() => setOpenGroups((p) => ({ ...p, [g.id]: !open }))}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-[7px] text-[13px] font-medium rounded-md transition-colors",
                    hasActive && !open ? "text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  )}
                >
                  <g.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{g.label}</span>
                  {open ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
                </button>
                {open && (
                  <div className="ml-3.5 pl-2 border-l border-white/10 mt-0.5 space-y-0.5">
                    {g.items.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-[6px] text-[13px] rounded-md transition-colors",
                          isActive(item.href) ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                        )}
                      >
                        <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Workspaces section */}
        <div className="pt-5">
          <div className="flex items-center justify-between px-2.5 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Workspaces</span>
            <Link href="/dashboard/workspaces" className="p-0.5 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300 transition-colors" title="All workspaces">
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
                    pathname.includes(ws.id) ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
                  )}
                >
                  {expandedWs[ws.id] ? <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-500" /> : <ChevronRight className="h-3 w-3 flex-shrink-0 text-gray-500" />}
                  <span className="w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: ws.color }}>
                    {ws.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{ws.name}</span>
                </button>

                {expandedWs[ws.id] && wsBoards[ws.id] && (
                  <div className="ml-5 mt-0.5 space-y-0.5">
                    {wsBoards[ws.id].map((board) => (
                      <Link
                        key={board.id}
                        href={`/dashboard/boards/${board.id}`}
                        className={cn(
                          "flex items-center gap-2 px-2.5 py-[6px] text-[13px] rounded-md transition-colors",
                          pathname.includes(board.id) ? "bg-white/10 text-white" : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                        )}
                      >
                        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: board.color }} />
                        <span className="truncate">{board.name}</span>
                      </Link>
                    ))}
                    <Link
                      href={`/dashboard/workspaces/${ws.id}/settings`}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-[6px] text-[13px] rounded-md transition-colors",
                        pathname === `/dashboard/workspaces/${ws.id}/settings` ? "bg-white/10 text-white" : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
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
            pathname === "/dashboard/profile" ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
          )}
        >
          <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0"><span className="truncate block">{user.name || user.email}</span></div>
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
