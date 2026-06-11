# 01 — Current State Audit

Audited June 2026 against branch `feature/production-planning` (contains all
earlier feature work; migrations `0000`–`0031`). Evidence-based: every claim was
verified by reading schema, routes, and the events layer.

## 1. Stack

- **App:** Next.js 16 App Router, single repo, ~238 API route handlers, 70+ dashboard pages.
- **Data:** Postgres (Neon in prod) via Drizzle ORM; one schema file `src/lib/db/schema.ts` (~3,300 lines, ~140 tables); SQL migrations in `drizzle/`.
- **Auth:** NextAuth v5 (credentials + magic link via Resend); separate portal-contact plane for the customer portal.
- **Storage:** Supabase/Azure Blob/S3 abstraction (`src/lib/storage.ts`).
- **Deploy:** Vercel (primary; daily cron on `/api/events/process`) + Azure Container Apps (Dockerfile, `scripts/azure-*.sh`); QMS dashboard deployed on Azure (v18).
- **Tests/CI:** 4 unit test files; no integration/e2e tests; **no CI pipeline**.

## 2. Module inventory

| Suite | Module | State | Notes |
|---|---|---|---|
| Work OS | Boards/groups/items/columns, comments, automations, forms intake | **Live** | The original monday-style core; `cellValues` EAV for custom columns |
| Work OS | Documents & e-sign (`signDocuments/Recipients/Fields/Events`), SOPs, PDF templates | **Live** | Used by quality; underused by other suites |
| Work OS | Timesheets (`timeLogs`) + clock-in scope ladder | **Live** | Labor roll-up to items partially wired |
| Quality & EHS | Inspections (templates, snapshots, NCR, signatures, audit log) | **Live** | The strongest module; quality loop → corrective board tasks works |
| Quality & EHS | Safety (incidents, safety actions) | **Partial** | `incident.reported` emits; no downstream CAPA/compliance loops |
| Supply chain | Products (+ categories, revisions, specs, BOM, ECR) | **Partial** | Master data is clean; **zero events emitted**; ECR/BOM loops unwired |
| Supply chain | Inventory (warehouses, locations, lots, serials, stock ledger, valuation, cycle counts) | **Live** | Ledger discipline good; `stock.low` alert defined but no consumer |
| Supply chain | Purchasing (requisitions, POs, GRN, landed cost, returns) | **Live** | PO approval + receipt→stock work; requisition flow mostly silent |
| Supply chain | Vendors (contacts, addresses, banks, performance, items) | **Live** | `vendor_performance` table exists; no automated scoring |
| Sales & finance | Estimates → Sales orders → Shipments (reserve/pick/pack/ship) | **Live** | Stock lifecycle rule (single deduction at shipment) implemented |
| Sales & finance | Invoicing, credit notes, recurring, dunning log, manual payments | **Live** | No payment gateways by design |
| Sales & finance | Books (ledger accounts, journals, trial balance), AP bills | **Partial** | Tables + reports exist; **no automated posting from operational events** |
| Sales & finance | Expenses (categories, advances, card transactions) | **Live** | Approval engine wired |
| Sales & finance | Customer portal (portal contacts, estimate accept/reject) | **Live** | Separate identity plane |
| Manufacturing | Work orders + materials | **Partial** | Only `workorder.released` emits; completion posts nothing to stock |
| Manufacturing | Production planning (work centers, shifts, skills, process templates, stage scheduling, conflicts, scenarios, material reservations) | **Live** (v18) | Planning engine + 10 screens; not yet coupled to maintenance/asset status |
| Manufacturing | Maintenance (assets, PM schedules, maintenance orders, parts) | **Partial** | Pure CRUD; no PM auto-generation, no parts→stock deduction, no events |
| People | Employees (+ manager hierarchy), departments | **Live** | Master record shared by everything |
| People | HR + Leave (types, balances, requests) | **Live** | Approval engine wired; balance roll-up on approval |
| People | Training (courses, lessons, enrollments, certifications) | **Live** | `course.completed` → auto-certification works; no cert-gating of work |
| Platform | Event outbox/dispatcher/consumers, entity links, link policies, activity feed, notifications + prefs, approval engine, localization, data IO (CSV) | **Live** | The spine — see coverage below |

## 3. Integration spine — adoption matrix

**Defined:** 103 `EventType`s, 30+ `AggregateType`s (`src/lib/events/types.ts`);
8 consumers (`src/lib/events/consumers.ts`): `runActivityFeed` (48 event types),
`runQualityLoop`, `runLaborRollup`, `runApprovalRouting`,
`runApprovalSubjectSync`, `runStockLedger`, `runCertificationIssue`,
`runNotifications`.

**Actual emission coverage: ~26 of 238 routes (~11%).**

| Module | Emits | Verdict |
|---|---|---|
| Invoices, payments | `invoice.created/sent`, `payment.recorded` | ✅ wired |
| Purchase orders | `po.submitted/sent/received` | ✅ wired |
| Sales orders, shipments | `salesorder.approved/cancelled/invoiced`, `shipment.picked/packed/shipped/delivered` | ✅ wired |
| Estimates (+ portal) | `estimate.sent/accepted/rejected/converted` | ✅ wired |
| Expenses, leave, enrollments, vendors, forms, time logs | submit/approve/complete events | ✅ wired |
| **Products / BOM / revisions / ECR** | none | ❌ silent master data |
| **Customers** | none | ❌ silent |
| **Assets / maintenance orders** | none (`asset.status_changed` defined, never emitted) | ❌ silent |
| **Work orders** | only `workorder.released`; complete/plan silent | ⚠️ partial |
| **Requisitions** | only `requisition.converted` (service path) | ⚠️ partial |
| **AP bills, journal entries, price lists, work centers, process templates** | none | ❌ silent |

**Approval engine adoption:** PO, vendor, expense, leave (✅). Missing:
requisitions, work orders, maintenance orders, ECR, sales returns, credit notes,
journal entries.

**`entity_links`:** written by exactly one loop (inspection `remediates` board
item). Estimate→SO/invoice conversion, PO↔requisition, GRN↔inspection, WO↔SO
links either use ad-hoc FKs or nothing.

**`link_policies`:** table + admin API exist; **not enforced** on document
creation paths.

## 4. Verified gap register

| # | Gap | Impact |
|---|---|---|
| G1 | 89% of routes emit no events | Activity feed/notifications/360° views blind to most of the business; downstream automation impossible |
| G2 | Missing consumers: `stock.low`→requisition, `workorder.completed`→material consumption + FG receipt, maintenance→parts deduction, shipment/invoice→GL posting, ECR→BOM revision, vendor performance scoring | The flagship cross-module loops the platform is sold on don't close |
| G3 | `entity_links` unused / `link_policies` unenforced | Relationship graph invisible in UI; governance is decorative |
| G4 | Branch fragmentation: `main` 20+ commits behind; `feature/business-ops` → `feature/product-management` → `feature/production-planning` stacked and **local-only**; no CI | Bus-factor risk; prod (v18) deployed from an unpushed stack |
| G5 | 4 unit test files; no integration tests over event loops | Consumers are idempotency-sensitive; refactoring them without tests is dangerous |
| G6 | 5 shared UI primitives; 70+ ad-hoc pages | Inconsistent UX; every feature pays full UI cost; monday-class polish unreachable page-by-page |
| G7 | Boolean `canAccess*` flags only (7 modules; newer modules not even flagged) | No approve-vs-edit distinction, no department scoping, no custom roles |
| G8 | No `organizations` layer; no API versioning, keys, or webhooks; event sweep cron daily | Multi-company consolidation, external integrations, and reliable async processing blocked |
| G9 | Books not posted from operations | Trial balance is manual-entry only; finance picture diverges from operational truth |
| G10 | Security debt: seed/debug endpoints, public bucket review, audit of rate-limit coverage pending | Pre-enterprise hardening required (tracked since the original action plan) |

## 5. What this means

The platform does **not** need a new architecture. It needs:

1. **Consolidation** of branches/CI/migrations (G4, G5) — [08-roadmap Phase 0](08-roadmap.md).
2. **Completion of the connective tissue** — event coverage, missing consumers,
   links, policy enforcement (G1–G3, G9) — Phase 1, specified in
   [04-module-relationship-map.md](04-module-relationship-map.md).
3. **Hardening for enterprise** — RBAC v2, org layer, API-first, security
   (G7, G8, G10) — Phases 2–4, specified in
   [06-enterprise-readiness.md](06-enterprise-readiness.md).
4. **UI convergence** on a real design system (G6) —
   [07-ui-ux-design-system.md](07-ui-ux-design-system.md).
