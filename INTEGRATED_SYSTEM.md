# QMS — Integrated System (Integrated Core)

This branch (`Integratedsystem`) implements the **Integrated core** of the
[Architecture Action Plan](ARCHITECTURE_ACTION_PLAN.md): the additive schema,
the event backbone, and the cross-module business loops that turn the six
independent MVP modules into one interconnected platform.

It is built **on top of** the existing MVP codebase — the plan is "largely
additive, not a rewrite" (Plan §D), so existing modules are preserved.

## What's implemented

### 1. Schema integration (`src/lib/db/schema.ts`, migration `drizzle/0001_*.sql`)
- **Tenancy** (Plan D.2): `workspaceId` added to `employees`, `workshops`,
  `emp_projects`, `time_logs`; `workspaceId` denormalized onto `items`.
- **Identity unification** (Plan D.3): `employees.userId` 1:1 FK to `users`
  (interim approach — `users` is canonical for reporting). `worker` role added
  for badge/PIN shop-floor identities.
- **Scope ladder / ancestry columns** (Plan B.4 / D.5b): `boardId`, `groupId`,
  `itemId`, `linkLevel` on `inspections`, `time_logs`, `sign_documents`.
- **Quality loop wiring** (Plan D.4.1): `inspection_actions` gains
  `workspaceId`, `boardId`, `itemId` so a corrective action becomes a board task.
- **New platform tables**:
  - `event_outbox` — transactional outbox (Plan D.5).
  - `entity_links` — generic loose associations (Plan D.4.2).
  - `link_policies` — admin scope-governance, per workspace × module (Plan D.5b).
  - `activity_feed` — unified timeline read model (Plan B.5.4).
  - `notification_preferences` — per-user fan-out choice (Plan D.5.2).
- **Soft archive**: `items.archivedAt` replaces the `"[Archived] "` name hack (Plan D.6).

### 2. Event backbone (`src/lib/events/`)
- `outbox.ts` — `emitEvent(tx, …)`: producers write the domain row **and** the
  event in the same transaction (no lost events, no dual-write drift).
- `dispatcher.ts` — drains pending events to consumers; inline fire-and-forget
  for low latency, with a **cron sweep** as the durable backstop (retry → dead).
- `consumers.ts` — the cross-module loops:
  - **Quality loop**: `inspection.flagged` → create a "Corrective Actions" board
    task, wire `inspection_actions.itemId`, link inspection `remediates` item.
  - **Labor loop**: `timelog.checked_out` → roll up onto the linked item.
  - **Notifications**: unified in-app/email fan-out honouring preferences.
  - **Activity feed**: one denormalized timeline row per meaningful event.

### 3. Configurable Linking & Scope Governance (`src/lib/services/linking.ts`)
Server-side enforcement of the scope ladder (`none → workspace → board → group
→ item`) against admin `link_policies`: mode (disabled/optional/required),
depth bounds, per-rung selection (locked/free/predefined), and ancestry-integrity
checks. One mechanism, every module (Plan B.4.5).

### 4. Read model (`src/lib/services/activity.ts`)
360° feeds at any level — task / board / workspace / per-actor — each a single
indexed read of `activity_feed` (Plan B.5).

### 5. API
- `POST /api/inspections/[id]/submit` — emits `inspection.submitted` /
  `.flagged` / `ncr.raised` transactionally, then dispatches.
- `PATCH /api/time-logs/[id]` — emits `timelog.checked_out` (labor loop).
- `POST /api/forms/[id]/submit` — emits `form.submitted` (intake loop) +
  denormalizes the tenant onto the created item.
- `GET|POST /api/events/process` — secured outbox sweep (Vercel Cron).
- `GET /api/items/[id]/activity` — 360° task timeline.
- `GET /api/activity?level=&id=` — board / workspace roll-up feed.
- `GET|PUT /api/link-policies` — admin scope-governance config.

## Operating it

```bash
npm install
npm run db:generate        # already generated: drizzle/0001_*.sql
npm run db:migrate         # apply to your Postgres
npm run build
```

Required env (see `.env.example`): `POSTGRES_URL`, `NEXTAUTH_SECRET`/`AUTH_*`,
Supabase storage keys, and **`CRON_SECRET`** (guards `/api/events/process`).
`vercel.json` schedules the outbox sweep every 5 minutes.

## Not in this slice (later phases of the plan)
360°/admin UI surfaces, the standalone worker service + Redis queue, OIDC/SSO,
read replicas / materialized board views, and the security hardening of Phase 0
(kill `seed`/`debug`, private buckets) — see Plan Parts F & G.
