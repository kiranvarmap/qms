# 06 — Enterprise Readiness

What separates a connected product from an enterprise platform: tenancy depth,
security, scale, API surface, and reporting.

## 1. Tenancy: organizations above workspaces

Today one `workspace` ≈ one company — members, boards, masters, settings are all
workspace-scoped, which already delivers multi-company isolation. The
enterprise tier adds a consolidation layer, **additively**:

- `organizations` (id, name, settings) and nullable
  `workspaces.organizationId`. Existing single-workspace customers are
  untouched (null org).
- **Branch model:** one org = legal company; its workspaces = branches/plants.
- **Org-shared masters (opt-in):** masters gain nullable `organizationId`;
  a workspace resolves pickers as `workspace ∪ org-shared`. Start with
  `products`, `vendors`, `customers`, `ledgerAccounts`.
- **Org roles:** `organization_members` (org admin, org viewer) granting
  cross-workspace reporting access without per-workspace membership.
- **Consolidated reporting:** report APIs accept `organizationId` and fan out
  across member workspaces (same queries, `workspaceId IN (…)`), with currency
  normalization via workspace currency settings.
- **Inter-branch transactions (later):** stock transfer between workspaces as
  paired movements; internal SO/PO mirroring — design when a customer needs it.

## 2. RBAC, audit, security, compliance

- **RBAC v2 permission sets** — specified in [02 §3](02-product-architecture.md).
  Single enforcement chokepoint stays `src/lib/services/access.ts`.
- **Audit:** events → `activity_feed` is the universal trail
  ([03 §5](03-data-architecture.md)); Phase 4 adds `updatedBy` + `version` on
  financial/HR tables and an admin "audit export" (feed slice by date/actor/
  aggregate, CSV).
- **Security hardening checklist (Phase 0/4):**
  - Remove/disable seed + debug endpoints in production builds.
  - Private storage buckets + signed URLs only; audit existing objects.
  - Rate limiting (`src/lib/rate-limit.ts`) coverage audit: auth, portal, public
    forms, sign endpoints.
  - Session hygiene: short-lived JWTs, rotation on privilege change; portal
    plane stays fully separated from staff auth.
  - Secrets via platform env only; `CRON_SECRET` on all job endpoints; webhook
    signing (below).
  - Dependency + image scanning in CI; `npm audit` gate.
- **Compliance posture (SOC 2 track):** change management via CI + protected
  `main`; access reviews (workspace member report); backup/restore runbook for
  Neon + storage; data-export and deletion procedures; uptime/error monitoring
  (Sentry or Azure App Insights) — none of this requires re-architecture, only
  operational discipline added in Phases 0 and 4.
- **OIDC/SSO (enterprise sales requirement):** NextAuth v5 provider per
  customer (Azure AD/Okta), mapped to workspace membership by domain — Phase 4.

## 3. Scalability path

Current: single Next.js app + Postgres + inline event dispatch with daily cron
backstop. That is fine to ~hundreds of active users per instance. The scale
path, in order of actual need:

1. **Cron frequency** (Phase 0): event sweep + job sweep every 5–15 min.
2. **Indexes & pagination** (Phase 1): audit hot paths (feed by aggregate,
   stock by product×warehouse, items by board); cursor pagination convention on
   all list APIs.
3. **Read models** (Phase 2): report endpoints move from ad-hoc aggregates to
   maintained projections where slow (stock valuation, AR aging, capacity load).
4. **Queue worker** (Phase 4, when inline dispatch shows latency): standalone
   worker (container next to the Azure app) polling the outbox — the outbox
   pattern means *nothing changes for producers*; Redis/queue only if polling
   proves insufficient.
5. **DB growth:** Postgres partitioning for `activity_feed`/`event_outbox` by
   month; archive policy for dead events. Read replicas only after that.

## 4. API-first & integrations

- **`/api/v1` versioned surface** (Phase 4): stable, documented REST over the
  same services the UI uses. Internal routes keep evolving; v1 is the contract.
- **OpenAPI from Zod:** generate the spec from `src/lib/validations` schemas
  (zod-to-openapi) so docs never drift.
- **Service auth:** `api_keys` (workspace-scoped, hashed, permission-set-bound,
  last-used tracking) for machine clients, alongside session auth.
- **Outbound webhooks — the integration story:** `webhook_subscriptions`
  (workspace, eventType filter, URL, secret). One consumer `runWebhooks`
  delivers signed (HMAC) payloads with retries/dead-letter — external systems
  subscribe to the *same* event catalogue the platform runs on. ERP/accounting
  sync, Slack/Teams, BI extracts all hang off this one mechanism.
- **Inbound:** public form intake (exists) + CSV data-io (exists) + v1 POST
  endpoints cover ingestion; purpose-built connectors only when a real customer
  integration demands it.

## 5. Reporting & analytics

- **Per-suite report hubs** (Phase 2/5): Finance (AR aging, revenue, margin by
  project), Procurement (spend, OTD, open POs), Inventory (valuation, reorder,
  dead stock), Manufacturing (capacity load, WO lateness, OEE-lite from
  maintenance downtime), Quality/EHS (NCR rate, CAPA aging, incident register,
  cert compliance matrix), People (leave, headcount, training completion).
  Pattern: API aggregate per report + saved filters; reads domain tables, feed
  for timelines.
- **Cross-module 360°:** item/board/vendor/customer/asset/employee record pages
  each aggregate their linked documents + feed slice (the `RecordPanel`,
  [07 §3](07-ui-ux-design-system.md)) — this is reporting users feel daily.
- **Star-schema export (Phase 5):** nightly export of facts (movements,
  journal lines, time logs, events) to the customer's BI via CSV/Parquet dump or
  webhook-fed warehouse. Don't build a BI tool inside the app.

## 6. Documents & e-sign as a platform layer

Position the existing DocSign stack (`signDocuments/Recipients/Fields/Events`,
PDF templates, SOPs) as the document layer for every suite: vendor contracts,
PO terms, delivery notes, HR letters/offer packs, training certificates, signed
inspection reports. Phase 1 wires `sign.completed` into `entity_links` guards
([04 §9](04-module-relationship-map.md)); Phase 3 gives every RecordPanel a
Documents tab (attach, generate from template, send for signature).
