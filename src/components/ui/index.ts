/* QMS design system — the single import point for all UI.
   `import { Button, Card, DataTable, Select, ... } from "@/components/ui"`

   Built on @vibe/core (monday.com Vibe). Raw Vibe components are re-exported
   wholesale; where QMS ships a standardized wrapper with the same name
   (Button, Label, Badge), the wrapper wins and the raw Vibe component is
   available as Vibe<Name>. See DESIGN_SYSTEM.md in this folder. */

// Full raw Vibe catalog (Badge is exported as VibeBadge there)
export * from "./vibe";
export { Button as VibeButton, Label as VibeLabel } from "./vibe";

// Standardized primitives (shadow the raw Vibe names)
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./card";
export { Button, buttonVariants, type ButtonProps } from "./button";
export { Badge, badgeVariants, type BadgeProps } from "./badge";
export { Input } from "./input";
export { Label } from "./label";

// Composite patterns
export * from "./select";
export * from "./date-field";
export * from "./data-table";
export * from "./page-header";
export * from "./stat-card";
export * from "./toolbar";
export * from "./form-field";
export * from "./confirm-dialog";
export * from "./confirm-provider";
export * from "./toaster";
