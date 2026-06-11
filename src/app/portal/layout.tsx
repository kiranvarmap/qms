import type { ReactNode } from "react";

// Customer Portal shell (Plan §6.5) — visually distinct from the staff
// dashboard, no sidebar, light theme. A separate identity plane.
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-gray-50 text-gray-900">{children}</div>;
}
