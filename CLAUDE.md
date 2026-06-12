# QMS App

Next.js (App Router) + Drizzle + NextAuth quality-management app.

## UI / Design system — mandatory

All UI comes from the Vibe (monday.com) design system layer in
`src/components/ui` — see `src/components/ui/DESIGN_SYSTEM.md` for the full
component map and conventions.

- Import UI only from `@/components/ui` (curated) or `@/components/ui/vibe`
  (raw @vibe/core catalog).
- Never use native `<select>`, `<table>`, `<input type="date">`,
  `window.confirm`, hand-rolled modals/dropdowns, or lucide-react icons in
  app code. Use `Select`/`MultiSelect`, `DataTable`/Vibe `Table`,
  `DateField`, `ConfirmDialog`, `Modal`, and `@vibe/icons` instead.
- Toasts: `useToast()` from `@/components/ui` (provider is wired in
  `src/components/providers.tsx`).
- Theme tokens live in `src/app/globals.css` (Vibe tokens + Tailwind palette
  remap). Don't hardcode colors; use the mapped Tailwind classes or Vibe
  CSS variables.
