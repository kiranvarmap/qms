"use client";

import * as React from "react";
import { DatePicker, DialogContentContainer } from "@vibe/core";
import { Calendar, CloseSmall } from "@vibe/icons";
import { cn } from "@/lib/utils";

/* Vibe DatePicker inside a popover, with the value API of a native
   <input type="date"> (yyyy-mm-dd strings) so it's a drop-in replacement. */

function toDate(value?: string | null): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function toValue(date?: Date): string {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(value?: string | null): string {
  const date = toDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export interface DateFieldProps {
  value?: string | null;
  onChange?: (value: string) => void;
  /** Inclusive yyyy-mm-dd bounds, like native min/max. */
  min?: string;
  max?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

export function DateField({
  value,
  onChange,
  min,
  max,
  placeholder = "Select date",
  disabled,
  required,
  clearable = true,
  id,
  name,
  className,
}: DateFieldProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const display = formatDisplay(value);

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* hidden input keeps native form submission + required validation */}
      {name && (
        <input
          type="text"
          name={name}
          value={value ?? ""}
          required={required}
          readOnly
          hidden
          aria-hidden
          tabIndex={-1}
        />
      )}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-[4px] border border-gray-300 bg-white px-3 text-sm text-text-primary transition-colors hover:border-gray-500 focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400",
          open && "border-primary ring-1 ring-primary"
        )}
      >
        <Calendar size={16} className="shrink-0 text-gray-500" />
        <span className={cn("flex-1 text-left truncate", !display && "text-gray-500")}>
          {display || placeholder}
        </span>
        {clearable && display && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear date"
            className="shrink-0 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-text-primary"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.("");
            }}
          >
            <CloseSmall size={14} />
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50">
          <DialogContentContainer>
            <DatePicker
              date={toDate(value)}
              isDateDisabled={(date) => {
                const minD = toDate(min);
                const maxD = toDate(max);
                if (minD && date < minD) return true;
                if (maxD && date > maxD) return true;
                return false;
              }}
              onDateChange={(date) => {
                onChange?.(toValue(date ?? undefined));
                setOpen(false);
              }}
            />
          </DialogContentContainer>
        </div>
      )}
    </div>
  );
}

/* Event-shaped variant for mechanical migration from native
   <input type="date">: onChange receives { target: { value } }. */
export interface DateInputProps extends Omit<DateFieldProps, "onChange"> {
  onChange?: (e: { target: { value: string } }) => void;
}

export function DateInput({ onChange, ...rest }: DateInputProps) {
  return (
    <DateField {...rest} onChange={(value) => onChange?.({ target: { value } })} />
  );
}
