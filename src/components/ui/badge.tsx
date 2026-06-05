import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Vibe-styled badge/label: pill shape, Vibe selected/semantic colors.
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--primary-selected-color)] text-[var(--primary-color)]",
        secondary:
          "border-transparent bg-[var(--ui-background-color)] text-[var(--primary-text-color)]",
        destructive:
          "border-transparent bg-[var(--negative-color-selected)] text-[var(--negative-color)]",
        success:
          "border-transparent bg-[var(--positive-color-selected)] text-[var(--positive-color)]",
        warning:
          "border-transparent bg-[var(--warning-color-selected)] text-[var(--primary-text-color)]",
        outline:
          "text-[var(--primary-text-color)] border-[var(--ui-border-color)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
