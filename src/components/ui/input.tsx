import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-[var(--border-radius-small)] border border-[var(--ui-border-color)] bg-[var(--secondary-background-color)] px-3 py-1 text-sm text-[var(--primary-text-color)] transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-[var(--placeholder-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:border-[var(--primary-color)] disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
