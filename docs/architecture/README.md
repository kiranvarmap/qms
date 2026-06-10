# Enterprise Architecture Blueprint

**Status:** Adopted direction (authored June 2026, audited against branch
`feature/production-planning`, migrations through `0031`).
**Audience:** product + engineering. **Scope:** how the current platform becomes a
deeply connected, enterprise-grade operations suite.

## The platform thesis

> **One work graph, one event bus, one approval engine, one activity feed, one
> master-data registry. Every module is a producer and consumer on this spine.
> No disconnected module.**

Concretely, the spine already exists in code and every current or future module
must plug into all five rails:

| Rail | Implementation | Contract for every module |
|---|---|---|
| Work graph | `workspaces → boards → groups → items` + scope-ladder columns (`boardId/groupId/itemId/linkLevel`) | Business documents carry scope-ladder context so they roll up to projects/tasks |
| Event bus | Transactional outbox `event_outbox` (`src/lib/events/outbox.ts`), dispatcher (inline + cron), idempotent consumers (`src/lib/events/consumers.ts`) | Every state-changing write emits a typed event in the same transaction |
| Approvals | Generic `approval_requests / approval_steps / approval_policies` (`src/lib/services/approvals.ts`) | Every sign-off flow uses the one engine — no per-module approval forks |
| Activity feed | `activity_feed` read model (`src/lib/services/activity.ts`) | Every meaningful event projects one timeline row → 360° views are free |
| Master data | Single `products`, `vendors`, `customers`, `employees`, `assets`, `warehouses`, `work_centers` tables | Documents reference golden records by FK; never a duplicate party/product table |

## Where we are honestly

The MVP grew into a ~140-table platform with 13 BRD-documented modules and the
integration spine above already built. The architecture is sound; the **adoption
of the spine is partial** — only ~11% of API routes emit events, `entity_links`
is used by one loop, `link_policies` is not enforced, and several modules
(products, work orders, maintenance, assets, customers) are siloed CRUD. The gap
is not "design an architecture"; it is **finish wiring every module into the
architecture that exists**, then harden it for enterprise. See
[01-current-state.md](01-current-state.md).

## Document map

| Doc | Answers |
|---|---|
| [01-current-state.md](01-current-state.md) | What exists today: module inventory, event-coverage matrix, verified gap register |
| [02-product-architecture.md](02-product-architecture.md) | Suites, modules, feature hierarchy, roles/permissions evolution, workflow ownership |
| [03-data-architecture.md](03-data-architecture.md) | Entity catalogue, relationship rules, master-data strategy, lifecycle & audit |
| [04-module-relationship-map.md](04-module-relationship-map.md) | The explicit loop catalogue: how every module connects to every other |
| [05-workflow-architecture.md](05-workflow-architecture.md) | Status machines, approvals v2, SLA/escalation, automation, notifications |
| [06-enterprise-readiness.md](06-enterprise-readiness.md) | Multi-org tenancy, RBAC v2, security/compliance, scale, API-first, reporting |
| [07-ui-ux-design-system.md](07-ui-ux-design-system.md) | Vibe/monday.com-style design system, component library, navigation, 360° record UX |
| [08-roadmap.md](08-roadmap.md) | Phase 0–5 roadmap from today's codebase to the enterprise platform, with risks |

## Related documents (not duplicated here)

- [`ARCHITECTURE_ACTION_PLAN.md`](../../ARCHITECTURE_ACTION_PLAN.md) — the original integration plan that produced the event core.
- [`INTEGRATED_SYSTEM.md`](../../INTEGRATED_SYSTEM.md) — what the `Integratedsystem` branch implemented.
- [`docs/brd/`](../brd/README.md) — per-module business requirements (00 interoperability + 01–13 modules).

## Non-negotiable design rules (apply to all future work)

1. **Additive, not a rewrite.** Extend tables and rails in place; no forks of
   `employees`, `entity_links`, `event_outbox`, approvals, or the feed.
2. **Every state change emits an event** inside the producing transaction.
   Consumers are idempotent (check-before-apply). Payloads carry IDs, not blobs.
3. **Ledgers are append-only** (`stock_movements`, `journal_lines`, `time_logs`,
   `activity_feed`). Never mutate a counter without a ledger row.
4. **Tenant isolation everywhere:** every query filters `workspaceId`; module
   access via `hasModuleAccess()` (`src/lib/services/access.ts`).
5. **Documents soft-delete** (`archivedAt` / status `void|cancelled`); financial
   and quality records are never hard-deleted.
6. **Money is integer minor units** via `src/lib/money.ts`; numbering via
   `document_sequences`; no floating-point currency, no ad-hoc counters.
7. **Cross-document relationships are typed `entity_links`** (`fulfills`,
   `remediates`, `converted_from`, `evidence_for`, `billed_by`, …); master-data
   references are FKs; project context is the scope ladder. Pick the right one —
   never invent a new join table for a pair of documents.
