# Audit 03 — Manufacturing & Quality/EHS (Work Orders, Planning, Maintenance, Inspections, Safety)

Cross-cutting gaps P1–P12 ([README §2](README.md)) apply throughout.
✅ verified working · ⚠️ half-baked · ❌ missing.

---

## 1. Work orders

### Exists today
- The best-closed manufacturing loop in the app: create (BOM-explosion
  snapshot + auto feasibility) → release → complete, where **complete consumes
  materials and receives finished goods via the stock ledger** ✅. Plus
  plan/simulate/feasibility/priority/reserve-materials actions and screens
  (list, detail, plan, simulate).

### Half-baked / missing (verified)
- ⚠️ No PATCH (can't fix qty/date/notes after create) and no delete/cancel
  cleanup of reservations.
- ⚠️ List/detail don't surface the customer/SO a WO fulfills (no `fulfills`
  link written), nor cost (planned vs actual).
- ❌ No clone; no WO PDF/traveler (shop-floor paper); no operation-level
  start/stop (stage execution tracking exists in planning schedules but no
  shop-floor "my station" execution screen); no scrap/yield recording at
  completion (BOM `scrapPct` unread); no partial completion.

### Enterprise target model
*Benchmark: ERPNext work order + Odoo MRP.*
- Editable until release; cancel releases reservations; partial completions
  (produce 60 of 100, ledger-correct); completion records actual qty + scrap →
  yield reporting; actual cost roll-up (materials at valuation + labor from
  timeLogs scoped to the WO) vs planned.
- Shop-floor execution view: per-stage start/pause/complete tied to
  `jobStageSchedules`, operator clock-in against the stage (reuses timeLogs),
  QC checkpoint enforcement (`qaCheckpointRequired` → spawn inspection, block
  next stage on fail).
- WO RecordPanel: materials (reserved/issued/consumed), stages, linked SO/
  product/inspections, costs, activity. Traveler PDF.

---

## 2. Production planning (engine, work centers, skills, scenarios)

### Exists today
- A real finite-capacity engine ✅ (`src/lib/services/planning-engine.ts`):
  reads templates/stages/skills/shifts/machines/asset downtime → writes
  `jobStageSchedules`, `jobStageAssignments`, `planningConflicts`,
  `materialReservations`; 9 conflict types; override knobs (extra headcount,
  expedite PO, move job, hours/day). Screens: timeline (Gantt), capacity
  heatmap, materials, bottlenecks, skills. Work centers + machines + shifts
  full CRUD ✅. Process templates full CRUD incl. stages/materials/skills ✅.

### Half-baked / missing (verified)
- ⚠️ **`planningScenarios` has zero API** — simulate works in-memory but
  scenarios can't be saved/listed/compared/applied.
- ⚠️ Engine ignores **leave/absence** (no `leave_requests` input) and doesn't
  detect **employee double-booking across jobs**; shift-overlap with stage
  schedule unvalidated.
- ⚠️ Conflict resolution is read-only: expedite-PO / reassign actions surfaced
  as suggestions but not executable from the bottlenecks screen.
- ⚠️ Process template `approvedBy` written without an approval flow; no
  version history/rollback; no clone.
- ⚠️ `materialReservations` are planning-only (by design — stock moves at WO
  completion) but the two reservation systems (planning vs stock `committed`)
  are not reconciled anywhere.
- ❌ No BOM-circularity guard; no machine efficiency/meter tracking; no shift
  calendar export.

### Enterprise target model
*Benchmark: Odoo MRP planning + APS-lite.*
- Scenario CRUD: save engine output as scenario, diff two scenarios (dates,
  conflicts, cost), apply one (writes schedules atomically).
- Engine inputs extended: approved leave + existing assignments (double-booking
  check) + asset downtime from maintenance orders (already modeled).
- Actionable conflicts: each `planningConflicts` row carries executable
  actions (create expedite note on PO, reassign employee, split stage) — the
  automation sentence pattern.
- Template governance: approval via the engine, version snapshots, clone;
  planned-vs-actual feedback loop (stage durations refined from execution data).

---

## 3. Maintenance & assets

### Exists today
- Assets CRUD (no delete) with status up/down/maintenance/retired; maintenance
  orders create→start (sets asset to maintenance ✅)→complete (**consumes spare
  parts via stock ledger ✅**, returns asset to up); corrective/preventive
  types, priority, downtime hours field. Screens: maintenance list, assets list.

### Half-baked / missing (verified)
- ⚠️ **`pmSchedules` is schema-only**: no routes, no UI, no generation — the
  preventive-maintenance backbone doesn't run.
- ⚠️ Orders immutable after create (no PATCH/cancel/hold transitions beyond
  enum); no assignment notifications.
- ⚠️ Asset detail is minimal: no maintenance-history timeline, no downtime log,
  no cost roll-up, no linked work centers/incidents; `parentAssetId` hierarchy
  unsurfaced; `asset.status_changed` event never emitted (planning can't react).
- ❌ No meters/usage-based PM; no maintenance calendar; no MTBF/MTTR reporting;
  no checklists on maintenance orders (obvious inspection-template reuse).

### Enterprise target model
*Benchmark: ERPNext asset maintenance + Odoo maintenance + UpKeep-class CMMS.*
- PM engine: schedules CRUD UI; sweep generates orders at `nextDue` (date or
  meter), assigns team, notifies; missed-PM escalation.
- Order lifecycle: editable, hold/cancel, checklist (inspection template),
  labor (timeLogs) + parts → maintenance cost per asset.
- Asset 360°: history timeline (orders, incidents, status changes, movements
  between locations), downtime log feeding planning capacity, hierarchy tree,
  documents (manuals, warranties with expiry alerts), QR/barcode label for
  shop-floor lookup.
- Reporting: downtime by asset/cause, PM compliance %, MTBF/MTTR, maintenance
  cost by asset/category.

---

## 4. Inspections / quality

### Exists today
- The flagship: versioned templates (sections/questions, 13 question types,
  repeatable sections, role-gated sign-offs, scoring, conditional + flag
  rules), template-snapshot on inspection, responses, immutable signatures with
  void-audit, dedicated `inspectionAuditLog`, NCR numbering + disposition
  track, corrective actions → board tasks ✅, PDF export ✅, SOP library +
  links, PDF template designer. Full CRUD on templates/sections/questions and
  inspections.

### Half-baked / missing (verified)
- ⚠️ Photo question type exists; upload wiring for photo answers incomplete.
- ⚠️ Conditional/flag rules evaluated client-side only (server doesn't
  re-validate → integrity gap on submit).
- ⚠️ Template SOP links: join table + no management route.
- ❌ No template duplicate/versioned re-release flow (editing a published
  template mutates it); no scheduling/recurrence (audit calendar); no
  assignment workflow (assign inspector + due date + my-inspections queue);
  no offline capture; no inspection↔PO/GRN/asset linkage in UI (receiving QC,
  asset checks).

### Enterprise target model
*Benchmark: SafetyCulture (iAuditor) + QMS CAPA discipline.*
- Scheduling: recurring inspection plans (template × scope × frequency ×
  assignee) generated by sweep → my-inspections inbox with due/overdue states.
- Template lifecycle: draft→published→new-version (snapshot already exists at
  run time — add version rows + duplicate).
- Server-side rule evaluation on submit; photo/file answers via P9 attachments.
- Context links: spawn-from GRN/asset/WO-stage/incident with `evidence_for`
  links; failed receiving QC → quarantine movement.
- CAPA maturity: corrective actions get owners/due/verification step +
  effectiveness check; CAPA aging report; quality dashboard (pass rate, NCR
  rate by product/vendor/line, repeat-failure detection).

---

## 5. Safety / incidents

### Exists today
- Incident report→investigate→close with safety actions (assignee/due/open-
  done), severity + type enums, optional asset link, root-cause field; events
  emitted on report; list + detail screens.

### Half-baked / missing (verified)
- ⚠️ No PATCH — incident facts can't be corrected/enriched after reporting;
  `actions_open` status exists but transitions are only investigate/close.
- ❌ No photo/file evidence; no witness records or regulatory-reportability
  fields (OSHA-style); no severity-driven escalation (critical → notify
  safety officer + management immediately); no investigation checklist; no
  link to inspections (a failed safety inspection can't spawn an incident);
  no near-miss analytics, TRIR/LTIFR-style rates, or compliance register; no
  anonymous reporting channel.

### Enterprise target model
*Benchmark: SafetyCulture issues + EHS suites (Intelex-lite).*
- Intake: quick-report form (mobile-first, photo evidence, anonymous option,
  QR-posted forms via existing public forms).
- Lifecycle: reported→triaged(severity confirm)→investigating(checklist =
  inspection template; witness statements; 5-why/root-cause structured)→
  actions_open(CAPA tasks with verification)→closed(sign-off).
- Escalation: severity matrix → immediate notifications + mandatory
  investigation SLA; recurring safety-walk schedule (same engine as
  inspections).
- Compliance: reportability flags + register report (incidents by type/
  severity/area, lost-time tracking, action closure rate); link incidents ↔
  assets ↔ maintenance orders ↔ training gaps (worker missing cert on the
  task where incident occurred — powerful cross-module insight this platform
  is uniquely positioned to deliver).
