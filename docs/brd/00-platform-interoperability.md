# 00 — Platform Interoperability Foundation

This document describes the shared mechanisms that make the modules **one
interconnected platform** rather than a bundle of independent apps. Every module
BRD's *Interoperability & Integration* section refers back to the primitives
defined here.

Source of truth in code:
`src/lib/events/{types,outbox,dispatcher,consumers}.ts`,
`src/lib/services/{linking,activity,approvals,document-sequence}.ts`,
`src/lib/db/schema.ts`.

---

## 1. Why an integration layer exists

Modules must trigger work in each other **without hard service-to-service
coupling**: receiving a PO must raise inventory; flagging an inspection must
create a corrective-action task; accepting an estimate must create a sales
order; shipping must relieve stock and (optionally) raise an invoice.

Doing this with direct function calls produces a brittle web of dependencies and
"dual-write drift" (the domain row saved but the side-effect lost, or vice
versa). The platform instead uses **one mechanism, applied everywhere**:

> A producer writes its domain row **and** a domain event in the **same database
> transaction**. A dispatcher later (and inline, in real time) fans that event
> out to consumers and to the activity feed.

This gives at-least-once delivery, no lost events, retry/backoff, and a single
audit timeline.

---

## 2. The transactional outbox (`event_outbox`)

- Producers call `emitEvent(tx, { workspaceId, eventType, aggregateType,
  aggregateId, actorUserId, payload })` **inside** their write transaction
  (`src/lib/events/outbox.ts`). The event row commits atomically with the data.
- Each row: `id, workspaceId, eventType, aggregateType, aggregateId, payload
  (jsonb), actorUserId, occurredAt, attempts, status (pending|done|dead)`.
- **Payload** is free-form and event-specific; consumers read only what they need.
  Keep payloads small (IDs + the few fields needed to act) — consumers re-read
  current state from the DB to avoid stale data.

**Rule for every module:** any state change another module could care about is
emitted as an event in the same transaction as the change. Never call another
module's service directly for a side effect.

---

## 3. The dispatcher (`dispatcher.ts`)

- **Inline, fire-and-forget**: right after a request commits, the dispatcher
  drains pending events for low latency.
- **Cron sweep backstop**: `GET|POST /api/events/process` (guarded by
  `CRON_SECRET`) re-drains anything that failed inline, with `attempts`
  increment and eventual `dead` status for poison events.
- **Idempotency contract**: consumers must be safe to run more than once
  (at-least-once delivery). Use natural keys / "create if not exists" / version
  checks. Each module BRD states its idempotency keys.

---

## 4. Domain event catalogue (`types.ts`)

The typed `EventType` union is the **public contract between modules**. Current
catalogue (abridged; see code for the full list):

| Domain | Events |
|--------|--------|
| Item / inventory | `item.created/updated/status_changed/moved`, `stock.received/reserved/reservation_released/shipped/adjusted/low` |
| Quality | `inspection.submitted/flagged/signed/remediated`, `ncr.raised` |
| Intake | `form.submitted` |
| Labor | `timelog.checked_in/checked_out` |
| E-sign | `signdoc.sent/completed/declined` |
| Vendor / purchasing | `vendor.created`, `po.submitted/approved/rejected/sent/received`, `stock.received` |
| Sales | `estimate.sent/viewed/accepted/rejected/expired/converted`, `salesorder.approved/cancelled/invoiced`, `shipment.picked/packed/shipped/delivered` |
| Finance | `invoice.created/sent/paid/overdue`, `payment.recorded`, `expense.submitted/approved/rejected/reimbursed` |
| Workflow / HR | `approval.requested/approved/rejected`, `leave.requested/approved/rejected` |
| Portal | `portal.comment_added` |
| Training | `course.assigned/completed`, `certification.issued/expiring` |

`AggregateType` enumerates the entities events are about (`item, inspection,
vendor, customer, product, purchase_order, goods_receipt, estimate, sales_order,
shipment, invoice, payment, expense, approval_request, leave_request,
portal_contact, course, enrollment, certification_record, …`).

**Adding a module** = add its `EventType` and `AggregateType` members, emit them
from producers, and (optionally) subscribe consumers.

---

## 5. Generic associations (`entity_links`)

Not every relationship deserves a typed foreign key. `entity_links` stores loose
associations between any two aggregates: `(sourceType, sourceId) —
relation — (targetType, targetId)`, scoped by `workspaceId`.

Examples used across modules: inspection `remediates` item; PO `fulfills`
sales_order; invoice `bills` sales_order; expense `charged_to` project;
certification `qualifies` employee for a course.

Use `entity_links` when the link is many-to-many, optional, or cross-module and
discoverable; use a typed FK when it is structural and mandatory.

---

## 6. Scope ladder + governance (`linking.ts`, `link_policies`)

A single configurable mechanism governs **how deeply** a record may be linked
into the work hierarchy:

```
none → workspace → board → group → item
```

- `link_policies` is admin config **per workspace × module**: `mode`
  (`disabled | optional | required`), min/max depth, and per-rung selection
  (`locked | free | predefined`).
- `linking.ts` enforces it server-side, including **ancestry integrity** (a
  chosen group must belong to the chosen board, etc.).
- Ancestry columns (`boardId, groupId, itemId, linkLevel`) are denormalized onto
  linkable records (`inspections, time_logs, sign_documents,
  inspection_actions`, and analogously for new modules) for fast roll-ups.

Each module BRD states **which rung** its records attach at and whether linking
is optional/required by default.

---

## 7. Unified activity feed (`activity_feed`, `activity.ts`)

Every meaningful event also writes **one denormalized timeline row**. This powers
360° feeds at any level — per item/task, per board, per workspace, per actor —
each a single indexed read. Modules do **not** build their own activity logs;
they emit events and get the feed for free.

API: `GET /api/items/[id]/activity` (task timeline),
`GET /api/activity?level=&id=` (board/workspace roll-up).

---

## 8. Generic approvals (`approvals.ts`)

Approvals are a **cross-cutting service**, not re-implemented per module. Any
module can raise an `approval_request` (aggregate) against one of its records;
the service emits `approval.requested/approved/rejected`, and on resolution the
originating module reacts (e.g. PO becomes `approved`, expense becomes
`approved → reimbursable`). See [Module 07 — Approvals](07-approvals.md).

---

## 9. Document sequences (`document-sequence.ts`)

Human-facing numbers (PO-2026-00042, INV-2026-00187, SO-…, EST-…, GRN-…) are
allocated by a shared, gap-aware, per-workspace sequence service so numbering is
consistent, configurable (prefix/padding/reset cadence), and concurrency-safe.

---

## 10. Notifications (`consumers.ts` + `notification_preferences`)

A notification consumer fans selected events to in-app + email per-user
**preferences**. Modules declare *which* events should notify *which* roles;
they do not send notifications directly.

---

## 11. Cross-module flow map (the "business loops")

The headline interoperability flows the platform is designed around:

```
Procure-to-stock:
  vendor.created → po.submitted → approval.requested → po.approved → po.sent
    → po.received → goods_receipt → stock.received → (inventory raised)
    → invoice.created (AP bill) → payment.recorded

Quote-to-cash:
  estimate.sent → estimate.viewed → estimate.accepted → estimate.converted
    → salesorder.approved → stock.reserved → shipment.picked/packed/shipped
    → stock.shipped → salesorder.invoiced → invoice.sent → invoice.paid
    → payment.recorded

Quality loop:
  inspection.submitted → inspection.flagged → (board task created via consumer)
    → ncr.raised → inspection.remediated  [links: inspection remediates item]

Labor loop:
  timelog.checked_in → timelog.checked_out → (rolled up onto linked item)

People loops:
  leave.requested → approval.requested → leave.approved
  course.assigned → course.completed → certification.issued
    → certification.expiring (re-train trigger)
```

Each module BRD details its slice of these loops in section 19.

---

## 12. Localization & country configuration (global by design)

The platform is **multi-country**. Tax regimes, statutory identifiers, compliance
forms, currency, and formatting must **never be hard-coded** to one country.
Instead they are driven by a per-workspace **country/locale setting**; selecting a
country adapts the relevant fields and rules automatically.

**Country/locale profile (per workspace)**

- `country` (ISO 3166-1), `currency` (ISO 4217), `locale` (date/number/address
  format), `timezone`, optional `region/state` for sub-national tax.
- A **localization pack** per country provides the country-specific definitions
  below; unsupported countries fall back to a generic profile (manual tax codes,
  generic "Tax registration number").

**What the country setting drives**

| Concern | Driven by country pack | Examples |
|---------|------------------------|----------|
| **Tax regime** | tax model + default `tax_rates` | US sales/use tax (state/county), EU/UK **VAT**, India **GST** (CGST/SGST/IGST), GCC VAT, CA GST/HST |
| **Party tax identifiers** | label + validation format | US **EIN/TIN**, EU/UK **VAT number**, India **GSTIN/PAN**, AU **ABN** |
| **Vendor onboarding form** | statutory doc set | US **W-9 / W-8**, EU VAT cert, India GST cert |
| **Workforce compliance** | statutory doc set | US **I-9 / work authorization**, EU right-to-work, India PF/ESI ids |
| **e-Invoicing / filing** | compliance helpers | India e-invoice/IRN & GSTR, EU e-invoice, US 1099 |
| **Currency & money** | default currency, rounding | symbol, decimal places, rounding rule |
| **Formatting** | locale | date, number, address, phone, name order |

**Design rules for modules**

- Store the **semantic** value plus the country context, not a country-specific
  field name. e.g. a party has `taxRegistrationNumber` + `taxIdType` (resolved by
  the country pack), **not** a column literally named `gstin`.
- Tax is computed from configurable `tax_rates` selected by the workspace country
  (and region), per line tax code — no hard-coded percentages.
- Statutory document **types** (W-9, I-9, GST cert, …) come from the country pack;
  the upload/expiry mechanics are the same everywhere (see Vendor / HR BRDs).
- A workspace can override defaults (e.g. extra tax codes) but inherits the pack.

Module BRDs reference this section instead of naming any single country's tax
form; their *Configuration Settings* sections include the country/locale profile.

---

## 13. Integration design rules (apply to every module BRD)

1. **Emit, don't call.** Side effects across modules go through events.
2. **Atomic write+emit.** `emitEvent(tx, …)` in the same transaction.
3. **Idempotent consumers.** At-least-once delivery; dedupe on natural keys.
4. **Tenant on every row.** `workspaceId` is mandatory on transactional data.
5. **Link, don't duplicate.** Reference shared entities (customer, product,
   vendor, employee) via FK or `entity_links`; never copy their master data.
6. **Money & numbers are shared services.** Use document-sequence + the money
   convention; do not roll your own counters or float math.
7. **Permissions are workspace-scoped + role-based.** Reuse `access.ts`.
8. **Everything auditable.** Events + activity feed + field-level change history.
9. **Localize, don't hard-code.** Tax, tax IDs, statutory forms, currency, and
   formatting are driven by the workspace country/locale pack (§12), never wired
   to one country.
