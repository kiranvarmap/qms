# 07 — UI/UX Direction & Design System

Reference: **monday.com's Vibe design system** (https://vibe.monday.com) —
clean, board-first, visually simple but powerful. The Vibe palette is already
mapped into our Tailwind v4 tokens (`src/app/globals.css`: primary `#0073ea`,
positive `#00854d`, negative `#d83a52`, warning `#ffcb00`, etc.). What's missing
is not the look — it's the **system**: 70+ dashboard pages are ad-hoc
compositions over only 5 shared primitives (`src/components/ui/`). This doc
defines the component architecture every page converges on.

## 1. Design principles

1. **Board-first:** any collection is viewable as *table / kanban / timeline /
   calendar* — views over the same data, switchable per saved view, monday-style.
2. **Connectedness is visible:** every record page shows its relationship graph
   (linked documents via `entity_links` + scope ladder) and its activity
   timeline. If the architecture links it, the UI shows it.
3. **Sentence-simple actions:** statuses are colored pills with one-click
   transition menus (only legal transitions, from the per-module transition map,
   [05 §1](05-workflow-architecture.md)); automations read as sentences.
4. **No dead ends:** every entity reference anywhere (a vendor name on a PO, a
   product on a BOM line) is a hoverable chip → peek card → full record.
5. **Light, dense, calm:** white panels, dark sidebar (the deployed light Zoho/
   monday hybrid), 8px grid, Figtree/Inter-class type ramp, restrained color —
   color means status, not decoration.

## 2. Component library (`src/components/ui/` → the platform kit)

Build once in Phase 3, migrate pages suite-by-suite. Priority order:

| Component | Spec |
|---|---|
| **`DataTable`** | The workhorse. Column defs, sort/filter/search, saved views (per user+page), column show/hide + resize, inline cell edit (status pill, person, date, number), row selection + bulk actions, virtualized rows, CSV export (reuse data-io), empty/loading/error states. Kills the 70 hand-rolled tables. |
| **`BoardView` / `TimelineView` / `KanbanView`** | Alternate renderers over the same column-def + data contract as `DataTable`. Board view already exists for Work OS; generalize its data contract. |
| **`RecordPanel`** | Slide-over (or full page) for any document/master: header (docNumber, status pill + legal transitions, owner, key fields), tab strip — **Details / Lines / Linked records / Documents / Approvals / Activity**. Linked = `entity_links` + scope ladder both directions. Activity = feed slice. Approvals = engine widget. One component, every module. |
| **`EntityPicker`** | Typeahead for any master (product, vendor, customer, employee, asset, account…) with create-inline, recent items, archived exclusion, org-shared badge. Single component so golden-record discipline shows up in UX. |
| **`StatusPill`** | Status rendering + transition dropdown driven by the transition map; consistent color semantics across modules. |
| **`ApprovalWidget`** | Step list (who, when, decision, SLA countdown), approve/reject with comment, delegation indicator. Used in RecordPanel + My Work. |
| **`ActivityTimeline`** | Renders a feed slice (actor, action, diff summary, timestamp) with filters; used everywhere from item 360° to vendor history. |
| **`FormBuilder` / `FieldRow`** | Schema-driven forms from Zod definitions: consistent labels, validation errors, money/date/entity inputs. Stops per-page form drift. |
| **`Modal` / `Drawer` / `ConfirmDialog`** | Single overlay system, focus-trapped, stacked-safe. |
| **`KpiCard` / `ChartCard`** | Dashboard widgets: number + delta + spark, standard chart wrapper for report hubs. |
| **`Chip` / `PeekCard`** | The hoverable entity reference (principle 4). |

Existing 5 primitives (button, input, card, badge, label) get absorbed/extended,
not replaced. No external heavy UI dependency; Tailwind v4 + headless patterns
(consistent with current code).

## 3. Page templates

Three templates cover ~90% of the app; pages become configuration:

1. **Collection page** = header (title, view switcher, saved views, filters,
   New button) + `DataTable`/`BoardView` + bulk bar. *(invoices, POs, products,
   work orders, …)*
2. **Record page/panel** = `RecordPanel`. *(every document + master)*
3. **Hub/dashboard** = `KpiCard` grid + widget rows, role-aware. *(home, suite
   dashboards, report hubs)*

Specialized surfaces (inspection runner, course player, production-planning
Gantt, sign ceremony, time clock, portal) stay custom but consume the kit.

## 4. Navigation & information architecture

- **Sidebar:** suite-grouped collapsible sections (exists) in the
  [02](02-product-architecture.md) suite order, filtered by module permissions;
  workspace switcher on top; dark panel, light content.
- **Home = module launcher + role dashboard** (exists; upgrade to KpiCards:
  my approvals, my tasks, low stock, overdue invoices, expiring certs).
- **My Work** (new, Phase 2–3): cross-module inbox — approval steps awaiting
  me, tasks assigned to me, mentions, expiring items. The single most
  enterprise-feeling surface; entirely feed/engine-backed, no new data.
- **Global search / ⌘K** (Phase 3): typeahead across masters + documents
  (workspace-scoped indexed search), actions ("new invoice", "go to vendors"),
  recent records.
- **Breadcrumbs + chips** make the scope ladder navigable: a PO scoped to a
  project shows `Board ▸ Group ▸ Item` chips linking back to the work graph.

## 5. Interaction & quality bar (Vibe-calibrated)

- Optimistic UI on inline edits with rollback toasts; skeletons over spinners;
  empty states teach (one-line explanation + primary action).
- Keyboard: ⌘K, esc closes overlays, enter submits, arrow-navigation in tables.
- Accessibility: WCAG AA contrast on the token set, focus rings, aria on
  overlays/pills — bake into the kit so pages inherit it.
- Motion: 150–200ms ease transitions on overlays/hover peeks; no gratuitous
  animation.
- Density toggle (comfortable/compact) on DataTable for power users.

## 6. Migration strategy (no big-bang)

Phase 3 builds the kit + converts **one flagship suite end-to-end**
(recommended: Supply Chain — POs/products/inventory exercise table, record,
approval, links, ledger). Each subsequent suite migrates page-by-page; old and
new pages coexist because the kit is additive. Definition of done per page:
uses kit components only, RecordPanel for records, saved views work, no
page-local table/modal/form implementations left.
