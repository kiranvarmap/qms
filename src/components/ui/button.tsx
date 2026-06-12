"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Button as VibeButton } from "@vibe/core";
import { cn } from "@/lib/utils";

/* Vibe-styled classes, used for the `asChild` path (links styled as buttons)
   so they match the real @vibe/core Button rendered otherwise. */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--border-radius-small)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary-color)] text-[var(--text-color-on-primary)] hover:bg-[var(--primary-hover-color)]",
        destructive:
          "bg-[var(--negative-color)] text-[var(--text-color-on-primary)] hover:bg-[var(--negative-color-hover)]",
        outline:
          "border border-[var(--ui-border-color)] bg-transparent text-[var(--primary-text-color)] hover:bg-[var(--primary-background-hover-color)]",
        secondary:
          "bg-[var(--ui-background-color)] text-[var(--primary-text-color)] hover:bg-[var(--ui-background-hover-color)]",
        ghost:
          "text-[var(--primary-text-color)] hover:bg-[var(--primary-background-hover-color)]",
        link: "text-[var(--link-color)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const vibeKind: Record<string, "primary" | "secondary" | "tertiary"> = {
  default: "primary",
  destructive: "primary",
  outline: "secondary",
  secondary: "secondary",
  ghost: "tertiary",
  link: "tertiary",
};

const vibeSize: Record<string, "xs" | "small" | "medium"> = {
  default: "small",
  sm: "xs",
  lg: "medium",
  icon: "small",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading,
      type,
      disabled,
      onClick,
      onFocus,
      onBlur,
      name,
      id,
      style,
      children,
      ...rest
    },
    ref
  ) => {
    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }))}
          ref={ref}
          {...rest}
        >
          {children}
        </Slot>
      );
    }

    const v = variant ?? "default";
    const s = size ?? "default";
    const ariaProps = Object.fromEntries(
      Object.entries(rest).filter(
        ([key]) => key.startsWith("aria-") || key.startsWith("data-")
      )
    );

    return (
      <VibeButton
        ref={ref}
        kind={vibeKind[v]}
        color={v === "destructive" ? "negative" : "primary"}
        size={vibeSize[s]}
        type={(type as "button" | "submit" | "reset") ?? "button"}
        disabled={disabled}
        loading={loading}
        onClick={
          onClick as ((e: React.MouseEvent<HTMLButtonElement>) => void) | undefined
        }
        onFocus={onFocus}
        onBlur={onBlur}
        name={name}
        id={id}
        style={style}
        className={cn(
          v === "link" && "underline-offset-4 hover:underline",
          s === "icon" && "!px-1 aspect-square",
          className
        )}
        {...ariaProps}
      >
        {children}
      </VibeButton>
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
