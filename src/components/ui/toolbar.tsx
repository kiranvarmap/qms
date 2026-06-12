import * as React from "react";
import { cn } from "@/lib/utils";

/* monday-style board toolbar: search + filter controls in a single row
   above tables/boards. Pass Search, Select, DateField, Button as children. */

export interface ToolbarProps {
  children: React.ReactNode;
  /** Content pushed to the right edge (e.g. a primary action). */
  end?: React.ReactNode;
  className?: string;
}

export function Toolbar({ children, end, className }: ToolbarProps) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-wrap items-center gap-2",
        className
      )}
    >
      {children}
      {end && <div className="ml-auto flex items-center gap-2">{end}</div>}
    </div>
  );
}
