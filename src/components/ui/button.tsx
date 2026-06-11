import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Vibe-styled button: 4px radius, Figtree medium weight, Vibe semantic colors.
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--border-radius-small)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-40",
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
