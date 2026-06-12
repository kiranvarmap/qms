import * as React from "react";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

/* Dashboard KPI tile: label, big value, optional icon and trend hint. */

export interface StatCardProps {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({ label, value, hint, icon, className }: StatCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
          {hint && <p className="mt-1 text-xs text-text-secondary">{hint}</p>}
        </div>
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-blue-50 text-primary">
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
