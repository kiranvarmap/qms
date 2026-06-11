import Link from "next/link";
import {
  Inbox, BarChart3, Users2, FileText, ClipboardList, Receipt, Building2, ShoppingCart,
  Boxes, Warehouse, Wallet, Clock, UserCog, CalendarDays, GraduationCap, FileSignature,
  type LucideIcon,
} from "lucide-react";

interface Tile { name: string; href: string; icon: LucideIcon }
interface Group { label: string; tiles: Tile[] }

// Role-aware quick-launch grid for the Home dashboard. Static links only.
export function ModuleLauncher({ role }: { role?: string }) {
  const mgr = role === "admin" || role === "manager";

  const groups: Group[] = [
    {
      label: "Workspace",
      tiles: [
        { name: "Approvals", href: "/dashboard/approvals", icon: Inbox },
        ...(mgr ? [{ name: "Reports", href: "/dashboard/reports", icon: BarChart3 }] : []),
        { name: "Inspections", href: "/dashboard/inspections", icon: ClipboardList },
        { name: "Documents", href: "/dashboard/sign", icon: FileSignature },
      ],
    },
    ...(mgr ? [{
      label: "Sales",
      tiles: [
        { name: "Customers", href: "/dashboard/customers", icon: Users2 },
        { name: "Estimates", href: "/dashboard/estimates", icon: FileText },
        { name: "Sales Orders", href: "/dashboard/sales-orders", icon: ClipboardList },
        { name: "Invoices", href: "/dashboard/invoices", icon: Receipt },
      ],
    }] : []),
    ...(mgr ? [{
      label: "Procurement & Inventory",
      tiles: [
        { name: "Vendors", href: "/dashboard/vendors", icon: Building2 },
        { name: "Purchase Orders", href: "/dashboard/purchase-orders", icon: ShoppingCart },
        { name: "Products", href: "/dashboard/inventory", icon: Boxes },
        { name: "Warehouses", href: "/dashboard/inventory/warehouses", icon: Warehouse },
      ],
    }] : []),
    {
      label: "People & Finance",
      tiles: [
        { name: "Time Clock", href: "/dashboard/time-clock", icon: Clock },
        ...(mgr ? [
          { name: "Expenses", href: "/dashboard/expenses", icon: Wallet },
          { name: "HR", href: "/dashboard/hr", icon: UserCog },
          { name: "Leave", href: "/dashboard/leave", icon: CalendarDays },
          { name: "Training", href: "/dashboard/training", icon: GraduationCap },
        ] : []),
      ],
    },
  ];

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-2">{g.label}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {g.tiles.map((t) => (
              <Link
                key={t.name}
                href={t.href}
                className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <t.icon className="h-6 w-6 text-blue-500" />
                <span className="text-xs font-medium text-gray-700">{t.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
