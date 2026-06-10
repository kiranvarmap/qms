# 05 — Workflow Architecture

One workflow pattern for the whole platform: **document status machine +
approval engine + events + notifications**. No module invents its own.

## 1. The standard workflow anatomy

Every business document follows the same anatomy:

```
draft ──submit──▶ pending_approval ──approve──▶ approved/active ──work──▶ done ──▶ closed
   │                    │ reject                      │ cancel
   └── (editable)       ▼                             ▼
                     rejected                     cancelled
```

- **Transitions are API actions** (`/submit`, `/approve`, `/receive`, `/ship`…),
  never raw status PATCHes. Each transition: validates the precondition, writes
  the row, **emits the event in the same transaction**, returns the new state.
- **Variants per document type** keep their existing richer states (PO:
  `sent → partially_received → received`; SO: `reserved → picking → packed →
  shipped → delivered → invoiced`; inspections keep their signature flow). The
  invariant is the *shape*: explicit states, transition endpoints, events.
- **Status enums live in the schema**, transition legality in one
  per-module map (`canTransition(doc, from, to)`) so the UI can render valid
  actions generically (the `RecordPanel` in [07](07-ui-ux-design-system.md)
  reads this map).

## 2. Approval engine v2 (extend `src/lib/services/approvals.ts`)

Today: `approval_requests` + ordered `approval_steps`, used by PO, vendor,
expense, leave; `runApprovalRouting` notifies, `runApprovalSubjectSync` mutates
the subject on outcome. Keep all of it. Add:

1. **Policy-driven step templates** — enforce `approval_policies` (schema
   exists): per workspace × subjectType, resolve steps at submit time from
   rules: *manager chain* (via `employees.managerEmployeeId`, N levels),
   *role/permission-set holder* (e.g. "any Finance approve-holder"), *specific
   employee*, with **threshold conditions** (amount ≥ X adds a step). Seed
   default policies from the ownership matrix ([02 §4](02-product-architecture.md)).
2. **More subjects** — requisition, work order, maintenance order, ECR, credit
   note, sales return, journal entry. `runApprovalSubjectSync` gains one case
   per subject (table-driven map, not a switch sprawl).
3. **SLA + escalation** — add `dueAt` to `approval_steps` (policy sets hours).
   Cron sweep emits `approval.overdue` → notify approver + requester; after a
   second window, escalate: activate the approver's manager as alternate
   approver and notify. All recorded as steps, so the audit trail is complete.
4. **Delegation / out-of-office** — `approval_delegations` (employee, delegate,
   window); step resolution substitutes the delegate at activation time.
5. **Bulk approval surface** — the My Work inbox ([07 §4](07-ui-ux-design-system.md))
   lists `approval_steps` awaiting me across all modules with one-click
   approve/reject + comment (API already generic: `/api/approvals`).

## 3. Task automation (extend the existing `automations` engine)

Today `automations` are board-scoped triggers. Evolve into **event recipes**:

- **Trigger:** any `EventType` from the catalogue (+ optional filters on
  payload/aggregate, e.g. `invoice.overdue` where `total > X`).
- **Actions (reuse existing capabilities, no new executors):** create board
  task (the `runQualityLoop` pattern), notify user/role, request approval,
  set document field/status, create linked document draft (requisition, PO,
  maintenance order), send email.
- **Implementation:** one generic consumer `runAutomations(event)` that loads
  matching recipes for the workspace and executes actions idempotently
  (recipe-run log in `automationLogs`). System loops (stock, quality, GL) stay
  hard-coded consumers; recipes are for *customer-configurable* glue.
- **UI:** recipe builder "When ⟨event⟩ [if ⟨condition⟩] then ⟨action⟩" — the
  monday-style automation sentence, listed per workspace with run history.

## 4. Notifications

Keep the single fan-out (`runNotifications` + `notification_preferences`), add
taxonomy so volume scales without drowning users:

| Class | Examples | Delivery |
|---|---|---|
| **Action required** | approval step assigned, QC hold, escalation | in-app + email, never batched |
| **FYI (watched)** | status changes on documents I own/follow, mentions | in-app; email per prefs |
| **Digest** | low stock summary, overdue invoices, expiring certs | daily/weekly rollup email |

- Add `category` to notifications; preferences become per category × channel.
- **Watchers:** `entity_watchers (userId, refType, refId)` — follow any
  document; FYI class routes to watchers + owner, not the whole workspace
  (today's broadcast-to-members is too noisy at enterprise scale).

## 5. Status tracking, dependencies, escalations

- **Tracking:** every document's history = its `activity_feed` slice (free,
  already indexed by aggregate). The `RecordPanel` shows it; reports aggregate it.
- **Cross-object dependencies:** expressed as `entity_links` + guard checks at
  transition time (can't ship more than reserved; can't close WO with open QC
  hold; can't activate vendor without signed contract if policy says so).
  Guards live in the transition endpoints, returning structured 409s the UI
  renders as "blocked by X" with a link.
- **Escalations beyond approvals:** the same SLA sweep pattern applies to any
  document with `dueAt`/`expectedDate` (PO overdue from vendor, task overdue,
  PM overdue) → `*.overdue` events → notifications/automation recipes.

## 6. Cron architecture

One sweep endpoint (`/api/events/process`, `CRON_SECRET`-guarded) already
drains the outbox. Add a second scheduled job `/api/jobs/sweep` (same guard)
running the time-based scans: approval SLA, invoice overdue + dunning,
certification expiry, PM schedules due, estimate expiry, digest assembly.
Frequency: every 5–15 min on Pro plan (today's daily backstop is a Phase-0 fix);
each scan is idempotent and emits events rather than acting directly, so all
side effects still flow through consumers.
