import * as React from "react";
import { Label } from "./label";
import { cn } from "@/lib/utils";

/* Standard form row: label + control + help/error text, Vibe spacing.
   Server-component safe. */

export interface FormFieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  required?: boolean;
  help?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required,
  help,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-negative">*</span>}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-negative">{error}</p>
      ) : (
        help && <p className="text-xs text-text-secondary">{help}</p>
      )}
    </div>
  );
}
