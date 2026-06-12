# QMS Design System — Vibe (monday.com)

Every UI element in this app comes from this folder. It is built on
[@vibe/core](https://github.com/mondaycom/vibe) v4 (monday.com's Vibe design
system, https://vibe.monday.com) plus a small set of QMS composites for
patterns Vibe doesn't ship.

**Rule: pages and feature components import UI only from `@/components/ui`.**
No raw `<select>`, `<table>`, `<input type="date">`, hand-rolled modals,
ad-hoc buttons, or one-off card divs.

## Foundations

- Tokens: `@vibe/core/tokens` is imported in `src/app/globals.css`; the body
  carries `light-app-theme`. Tailwind palettes are remapped to the Vibe
  palette there, so utility classes render monday colors.
- Color anchors: primary `#0073ea`, positive `#00854d`, negative `#d83a52`,
  warning `#ffcb00`, text `#323338`/`#676879`, borders `#d0d4e4`/`#c3c6d4`,
  app background `#f6f7fb`.
- Typography: Figtree (via next/font, override on `<body>`). Page title
  24px/semibold, body 14px, secondary 13px `#676879`.
- Radii: 4px controls (buttons, inputs, pills), 8px cards/panels.
- Control height: 32px (`small` in Vibe sizes) is the default.

## Importing

```tsx
import { Button, Card, CardContent, DataTable, Select, DateField,
         PageHeader, Toolbar, FormField, ConfirmDialog, useToast,
         Flex, Heading, Text, Modal, Search, Tooltip } from "@/components/ui";
```

- `@/components/ui` (index.ts) — curated design system. Preferred.
- `@/components/ui/vibe` — raw @vibe/core catalog (client-boundary
  re-export, safe to render from server components).
- Where a QMS wrapper shadows a Vibe name, the raw component is available as
  `VibeButton`, `VibeLabel`, `VibeBadge`.
- Icons come from `@vibe/icons` (e.g. `Add`, `Edit`, `Delete`, `Search`,
  `Calendar`, `Filter`). Never lucide-react in new code.

## Component map — what to use for what

| Need | Use | Notes |
|---|---|---|
| Button / icon button | `Button`, `IconButton` | `Button` wrapper supports `asChild` links + Vibe kinds |
| Card / panel | `Card` + `CardHeader/Title/Description/Content/Footer` | 8px radius, border-defined |
| KPI tile | `StatCard` | label, value, hint, icon |
| Page heading | `PageHeader` | title + description + actions row |
| Table | `DataTable` (column config) or raw `Table/TableHeader/...` | loading/empty/error built into `DataTable` |
| Filter row above tables | `Toolbar` + `Search` + `Select` + `DateField` | monday board-toolbar pattern |
| Single select | `Select` | string `value`/`onChange` — drop-in for native `<select>` |
| Multi select | `MultiSelect` | string[] values |
| Date input | `DateField` | yyyy-mm-dd string API — drop-in for `<input type="date">` |
| Text input | `Input` (server-safe) or `TextField` (client, labels/validation) | |
| Textarea | `TextArea` | |
| Number input | `NumberField` | |
| Form row | `FormField` | label + control + help/error |
| Modal | `Modal` + `ModalBasicLayout` + `ModalHeader/Content/Footer` | |
| Confirm/delete dialog | `ConfirmDialog` | replaces `window.confirm` |
| Toast / notification | `useToast()` from the design system | `toast("Saved", "positive")` |
| Status pill | `Badge` (server-safe) or `VibeLabel`/`Chips` | |
| Tabs | `TabList`/`Tab`/`TabPanels`/`TabPanel` | |
| Menu / context menu | `MenuButton` + `Menu`/`MenuItem` | |
| Dropdown (raw) | `Dropdown`, `Combobox` | prefer `Select` wrapper |
| Banner / inline alert | `AlertBanner`, `AttentionBox` | |
| Empty state | `EmptyState` | |
| Loading | `Loader`, `Skeleton` | |
| Avatar | `Avatar`, `AvatarGroup` | |
| Layout primitives | `Flex`, `Box`, `Divider` | |
| Breadcrumbs | `BreadcrumbsBar`/`BreadcrumbItem` | |
| Toggle/checkbox/radio | `Toggle`, `Checkbox`, `RadioButton` | |
| Tooltip | `Tooltip` | |
| Progress | `ProgressBar`, `Steps`, `MultiStepIndicator` | |

## Conventions

- Default control size `small` (32px); `medium` for prominent CTAs.
- Primary action = one `Button` (primary kind) per view, top-right via
  `PageHeader actions` or `Toolbar end`.
- Destructive actions use `color="negative"` + `ConfirmDialog`.
- Tables live inside a `Card` or on the white surface; the page background
  is `--color-app-background` (#f6f7fb).
- Server components can use everything exported from `@/components/ui` —
  client boundaries are handled inside the design system.
