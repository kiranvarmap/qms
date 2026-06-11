# 08 — Implementation Roadmap

From today's codebase to the enterprise platform. Phases are sequential but
each is independently shippable; estimates assume the current solo/small-team
velocity evidenced by git history.

## Phase 0 — Consolidate & stabilize (1–2 weeks) — *do this first*

The platform's biggest immediate risk is not architectural; it's operational.

| # | Action | Detail |
|---|---|---|
| 0.1 | **Merge the branch stack** | `feature/business-ops` → `feature/product-management` → `feature/production-planning` are stacked and local-only. Merge the stack into `Integratedsystem`, then into `main`; delete merged branches; reconcile the stale `360` branch (3 commits behind its origin). |
| 0.2 | **Push everything** | All history to origin; protect `main` (PR-only). |
| 0.3 | **Apply migrations** | Verify prod DB is at `0031`; document the applied-migrations state per environment (`scripts/azure-migrate.sh` exists). |
| 0.4 | **CI pipeline** | GitHub Actions: install → lint → `tsc` → jest → build on every PR; `npm audit` gate. |
| 0.5 | **Cron frequency** | Event sweep + (new) job sweep every 5–15 min (Vercel Pro or Azure scheduled job) instead of daily. |
| 0.6 | **Security quick wins** | Disable seed/debug endpoints in prod; verify buckets private; rate-limit coverage check. |
| 0.7 | **Test harness for loops** | Integration-test rig: in-memory/ephemeral Postgres, helper to emit an event and run consumers twice asserting idempotency. ~10 tests covering the existing 8 consumers. **Prerequisite for Phase 1.** |

**Exit criteria:** one source of truth on origin/main, green CI, loop tests
passing, prod migrated.

## Phase 1 — Connective tissue completion (3–5 weeks)

Close gaps G1–G3: wire every module into the spine. Detailed specs in
[04-module-relationship-map.md](04-module-relationship-map.md) §10.

1. **Event emission everywhere:** every state-changing route emits in-transaction
   (products, customers, assets, work orders, maintenance, requisitions, AP
   bills, journals, price lists, work centers). Convention enforced by a CI
   grep/lint check: transition endpoints must call `emitEvent`.
2. **Missing consumers (in order):** material reservation + work-order
   completion postings; maintenance parts deduction + PM generation + asset
   status propagation; low-stock replenishment; receiving QC; vendor scoring;
   safety investigation loop; sweeps (cert expiry, invoice overdue/dunning, PM
   due).
3. **Links & governance:** converters/fulfillers write typed `entity_links`;
   `link_policies` enforced at document creation; backfill links for existing
   FK relations (one-off script).
4. **Module flags** for ungated modules (production, maintenance, safety, books).
5. Each consumer lands with its idempotency test (Phase-0 rig).

**Exit criteria:** event coverage ≈100% of state-changing routes; the seven
flagship loops close end-to-end in tests; record pages can show linked records.

## Phase 1.5 — Product completeness mechanisms (runs alongside Phases 1–3)

The [feature-completeness audit](audit/README.md) found twelve cross-cutting
product gaps (P1–P12) that recur in every module: list endpoints without
pagination/search, hard deletes without guards, no duplicate/clone, no saved
views, no document PDFs/email, unreachable lifecycle statuses, create-only
sub-entities, dead schema, no attachments/comments on documents, record pages
without related-records, thin import/export, and no global search. These are
**platform mechanisms, built once**: the list-query contract and soft-delete
guards land with Phase 1 API work; attachments, PDF/email service, saved
views, and search land with the Phase 3 kit; the per-module "missing
essentials" in the audit suite files are then scheduled into each suite's
Phase 3 migration so every suite exits feature-complete, not just restyled.
The audit's dead-schema register is a standing implement-or-remove backlog.

## Phase 2 — Workflow & approvals v2 (3–4 weeks)

Spec: [05-workflow-architecture.md](05-workflow-architecture.md).

- Policy-driven multi-step approvals (thresholds, manager chains), seeded from
  the ownership matrix; new subjects (requisition, WO, maintenance, ECR, credit
  note); SLA `dueAt` + escalation sweep; delegation.
- Automation recipes: `runAutomations` consumer + sentence-builder UI.
- Notification taxonomy (categories, watchers, digests).
- GL auto-posting (`runGlPosting` + posting-rule config) — Books becomes
  operationally true.
- ECR propagation loop.
- **My Work** API (approvals/tasks/mentions inbox).

**Exit criteria:** a PO over threshold routes manager→finance with SLA
escalation untouched by code; an admin builds "when invoice overdue → create
task" without a deploy; trial balance reflects operational documents.

## Phase 3 — Design system & UI convergence (5–8 weeks, parallelizable with 2)

Spec: [07-ui-ux-design-system.md](07-ui-ux-design-system.md).

- Build the kit: `DataTable` → `RecordPanel` → `EntityPicker`/`StatusPill`/
  `ApprovalWidget`/`ActivityTimeline` → `FormBuilder`/overlays → `KpiCard`.
- Convert the flagship suite (Supply Chain) end-to-end; then suite-by-suite
  migration; My Work UI; global ⌘K search; home dashboard upgrade.

**Exit criteria:** flagship suite fully on the kit with saved views + 360°
RecordPanels; every new page uses kit only; measurable page-code shrinkage.

## Phase 4 — Enterprise hardening (4–6 weeks)

Spec: [06-enterprise-readiness.md](06-enterprise-readiness.md).

- RBAC v2 permission sets (+ back-compat shim, then drop booleans).
- `organizations` layer: org membership, shared masters opt-in, consolidated
  reports.
- API v1 + OpenAPI from Zod + `api_keys`; **outbound webhooks** consumer.
- Audit additions (`updatedBy`/`version`), audit export; SSO (OIDC); monitoring
  (Sentry/App Insights); queue-worker for dispatch if latency demands.

**Exit criteria:** a two-branch company runs consolidated reports; an external
system consumes webhooks + v1 API with a scoped key; security checklist closed.

## Phase 5 — Analytics & ecosystem (ongoing)

- Per-suite report hubs + saved reports; margin-by-project; OEE-lite;
  compliance registers.
- Star-schema/BI export; portal expansion (vendor portal, customer order
  tracking); connector integrations as customer demand dictates.

## Rebuild / merge / extend verdicts

| Area | Verdict |
|---|---|
| Event core, approvals, feed, links, stock ledger, masters | **Extend** — sound as built |
| Books | **Extend** (auto-posting), not a new accounting engine |
| Boolean permissions | **Replace via shim** (permission sets) in Phase 4 |
| 70+ dashboard pages | **Converge** onto the kit page-by-page; no big-bang rewrite |
| `emp*` legacy tables (`empProjects`, `empTasks`) vs boards | **Merge later**: freeze new usage, migrate data onto boards/items when Work OS views land; until then they coexist |
| Stacked git branches | **Merge now** (Phase 0) |
| Nothing | is rebuilt from scratch — the additive doctrine held and continues |

## Risks & dependencies

| Risk | Mitigation |
|---|---|
| Consumer changes corrupt ledgers (idempotency bugs) | Phase-0 test rig is a hard prerequisite; replay-twice tests per consumer; ledger projections rebuildable by design |
| Branch merge conflicts/regressions (20+ commits unmerged) | Merge in stack order with build+tests at each step; tag pre-merge state |
| Permission migration breaks access | Shim period: sets derived from flags, dual-read, staged cutover, flags dropped last |
| UI migration stalls half-done | Suite-by-suite with per-page definition-of-done; kit is additive so old pages keep working |
| Event volume growth (feed/outbox bloat) | Monthly partitioning + archive policy (Phase 4); indexes audited in Phase 1 |
| Solo bus-factor | Phase 0 pushes everything + CI; docs (this set + BRDs) keep design recoverable |
| Scope creep on enterprise features | Org layer, SSO, webhooks gated on real customer pull; phases shippable independently |

## Sequence rationale

Phase 0 removes operational risk that could lose work. Phase 1 delivers the
user's stated #1 gap (connections) on the architecture that already exists —
highest value per effort. Phase 2 makes workflows enterprise-grade while the
data is now flowing. Phase 3's UI shows the connectedness Phases 1–2 created
(building UI first would showcase silos). Phase 4 hardens for bigger customers;
Phase 5 monetizes the accumulated data.
