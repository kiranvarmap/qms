import Link from "next/link";
import { Inbox, Chart as BarChart3, Group as Users2, Doc as FileText, CheckList as ClipboardList, Doc as Receipt, Location as Building2, Item as ShoppingCart, Item as Boxes, Work as Warehouse, CreditCard as Wallet, Time as Clock, Person as UserCog, Event as CalendarDays, Academy as GraduationCap, Signature as FileSignature } from "@vibe/icons";
type LucideIcon = React.ComponentType<{ className?: string; size?: string | number }>;

interface Tile { name: string; href: string; icon: LucideIcon }
interface Group { label: string; chip: string; hover: string; tiles: Tile[] }

// Role-aware quick-launch grid for the Home dashboard. Static links only.
// Each suite carries a Vibe content color (monday-style module identity).
export function ModuleLauncher({ role }: { role?: string }) {
  const mgr = role === "admin" || role === "manager";

  const groups: Group[] = [
    {
      label: "Workspace",
      chip: "bg-blue-50 text-primary",
      hover: "hover:border-blue-300",
      tiles: [
        { name: "Approvals", href: "/dashboard/approvals", icon: Inbox },
        ...(mgr ? [{ name: "Reports", href: "/dashboard/reports", icon: BarChart3 }] : []),
        { name: "Inspections", href: "/dashboard/inspections", icon: ClipboardList },
        { name: "Documents", href: "/dashboard/sign", icon: FileSignature },
      ],
    },
    ...(mgr ? [{
      label: "Sales",
      chip: "bg-purple-50 text-purple-600",
      hover: "hover:border-purple-300",
      tiles: [
        { name: "Customers", href: "/dashboard/customers", icon: Users2 },
        { name: "Estimates", href: "/dashboard/estimates", icon: FileText },
        { name: "Sales Orders", href: "/dashboard/sales-orders", icon: ClipboardList },
        { name: "Invoices", href: "/dashboard/invoices", icon: Receipt },
      ],
    }] : []),
    ...(mgr ? [{
      label: "Procurement & Inventory",
      chip: "bg-orange-50 text-orange-600",
      hover: "hover:border-orange-300",
      tiles: [
        { name: "Vendors", href: "/dashboard/vendors", icon: Building2 },
        { name: "Purchase Orders", href: "/dashboard/purchase-orders", icon: ShoppingCart },
        { name: "Products", href: "/dashboard/inventory", icon: Boxes },
        { name: "Warehouses", href: "/dashboard/inventory/warehouses", icon: Warehouse },
      ],
    }] : []),
    {
      label: "People & Finance",
      chip: "bg-teal-50 text-teal-600",
      hover: "hover:border-teal-300",
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
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.label}>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2.5">{g.label}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {g.tiles.map((t) => (
              <Link
                key={t.name}
                href={t.href}
                className={`group flex flex-col items-center justify-center gap-2.5 bg-white border border-gray-200 rounded-lg px-4 py-5 text-center shadow-[var(--box-shadow-xs)] hover:shadow-[var(--box-shadow-small)] hover:-translate-y-0.5 transition-all duration-150 ${g.hover}`}
              >
                <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg transition-transform duration-150 group-hover:scale-110 ${g.chip}`}>
                  <t.icon className="h-5 w-5" />
                </span>
                <span className="text-[13px] font-medium text-gray-700 group-hover:text-gray-900">{t.name}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
