"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox, Boxes, Receipt, CalendarDays, GraduationCap } from "lucide-react";

interface Summary {
  finance: { overdueCount: number };
  inventory: { lowStockCount: number };
  people: { pendingApprovals: number; pendingLeave: number };
  training: { certsExpiring: number };
}

const cards = (s: Summary) => [
  { label: "Open approvals", value: s.people.pendingApprovals, href: "/dashboard/approvals", icon: Inbox, alert: s.people.pendingApprovals > 0 },
  { label: "Overdue invoices", value: s.finance.overdueCount, href: "/dashboard/invoices", icon: Receipt, alert: s.finance.overdueCount > 0 },
  { label: "Low stock", value: s.inventory.lowStockCount, href: "/dashboard/inventory", icon: Boxes, alert: s.inventory.lowStockCount > 0 },
  { label: "Pending leave", value: s.people.pendingLeave, href: "/dashboard/leave", icon: CalendarDays, alert: false },
  { label: "Certs expiring", value: s.training.certsExpiring, href: "/dashboard/training", icon: GraduationCap, alert: s.training.certsExpiring > 0 },
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
      <h2 className="text-sm font-semibold text-gray-700 mb-3">Business Operations</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards(summary).map((c) => (
          <Link key={c.label} href={c.href} className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
            <div className="flex items-center justify-between">
              <c.icon className={`h-5 w-5 ${c.alert ? "text-amber-500" : "text-gray-600"}`} />
              <span className={`text-2xl font-semibold ${c.alert ? "text-amber-600" : "text-gray-900"}`}>{c.value}</span>
            </div>
            <div className="text-xs text-gray-500 mt-2">{c.label}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
