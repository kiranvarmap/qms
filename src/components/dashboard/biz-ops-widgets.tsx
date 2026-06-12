"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Item as Boxes, Doc as Receipt, Event as CalendarDays, Academy as GraduationCap } from "@vibe/icons";

interface Summary {
  finance: { overdueCount: number };
  inventory: { lowStockCount: number };
  people: { pendingApprovals: number; pendingLeave: number };
  training: { certsExpiring: number };
}

const cards = (s: Summary) => [
  { label: "Open approvals", value: s.people.pendingApprovals, href: "/dashboard/approvals", icon: Inbox, chip: "bg-blue-50 text-primary", alert: s.people.pendingApprovals > 0 },
  { label: "Overdue invoices", value: s.finance.overdueCount, href: "/dashboard/invoices", icon: Receipt, chip: "bg-red-50 text-negative", alert: s.finance.overdueCount > 0 },
  { label: "Low stock", value: s.inventory.lowStockCount, href: "/dashboard/inventory", icon: Boxes, chip: "bg-orange-50 text-orange-600", alert: s.inventory.lowStockCount > 0 },
  { label: "Pending leave", value: s.people.pendingLeave, href: "/dashboard/leave", icon: CalendarDays, chip: "bg-teal-50 text-teal-600", alert: false },
  { label: "Certs expiring", value: s.training.certsExpiring, href: "/dashboard/training", icon: GraduationCap, chip: "bg-purple-50 text-purple-600", alert: s.training.certsExpiring > 0 },
];

// Role-aware business-ops widgets for the Home dashboard (Plan §11).
export function BizOpsWidgets() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const wss = await fetch("/api/workspaces").then((r) => r.json()).catch(() => []);
      if (!Array.isArray(wss) || wss.length === 0) return;
      const res = await fetch(`/api/reports/summary?workspaceId=${wss[0].id}`);
      if (res.ok && !cancelled) setSummary(await res.json());
    })();
    return () => { cancelled = true; };
  }, []);

  if (!summary) return null;

  return (
    <div>
      <h2 className="text-[15px] font-semibold text-gray-800 mb-3">Business Operations</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards(summary).map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className="group block bg-white border border-gray-200 rounded-lg p-4 shadow-[var(--box-shadow-xs)] hover:shadow-[var(--box-shadow-small)] hover:-translate-y-0.5 hover:border-gray-300 transition-all duration-150"
          >
            <div className="flex items-center justify-between">
              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${c.chip}`}>
                <c.icon className="h-[18px] w-[18px]" />
              </span>
              <span className={`text-[28px] font-bold leading-none tracking-tight ${c.alert ? "text-negative" : "text-gray-900"}`}>
                {c.value}
              </span>
            </div>
            <div className="text-[13px] text-gray-500 mt-3 group-hover:text-gray-700 transition-colors">{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
