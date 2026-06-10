# Audit 04 — Work OS, People & Platform (Boards, Forms, E-sign, Time, HR/Leave/Training, Approvals, Notifications, Reports, Platform)

Cross-cutting gaps P1–P12 ([README §2](README.md)) apply throughout.
✅ verified working · ⚠️ half-baked · ❌ missing.

---

## 1. Boards / items (the monday.com core)

### Exists today
- Boards/groups/columns/items full CRUD ✅; 11 column types (text, number,
  status, date, person, dropdown, checkbox, link, priority, rating, formula);
  table + **Gantt + calendar views** ✅; item detail panel with comments,
  linked inspections, time logs, activity ✅; item move between groups ✅;
  @mention storage on comments; per-column and per-item permission tables;
  workspace relabeling (Board→Project etc.) ✅.

### Half-baked / missing (verified)
- ⚠️ `items.archivedAt` exists with **no archive route, view, or restore**;
  board delete is hard.
- ⚠️ Bulk-action UI state declared but no endpoint/execution.
- ⚠️ Column/item permission tables exist; enforcement on board reads/writes not
  consistently visible; **no admin UI** to manage them.
- ⚠️ Mentions stored but no mention-specific notification event.
- ❌ **Kanban view** (status-as-column — table/Gantt/calendar exist, the most
  iconic view doesn't); **saved views/filters** (client-state only); **item/
  board duplicate**; **board templates**; **subitems** (no `parentItemId`);
  due-date reminders (`date_reached` trigger defined, no scheduler); threaded
  replies/reactions; item watchers; cross-board dependencies.

### Enterprise target model
*Benchmark: monday.com / ClickUp baseline.*
- View parity: kanban + saved views (P4) per board with shareable defaults.
- Duplicate item/board (with/without values), board templates library
  (workspace + system templates), archive/restore + trash (30-day), subitems
  or checklist column (decide: checklists cheaper, subitems more monday-like).
- Reminder scheduler: sweep evaluates `date_reached` automations + per-user
  "my due items" digest.
- Permission admin UI on the existing tables; enforcement audited and tested.
- Item dependencies (blocks/blocked-by via `entity_links`) reflected in Gantt.

---

## 2. Forms intake

### Exists today
- Form builder per board, public slug submission ✅ → creates item + cell
  values + fires automations + event ✅; field↔column mapping; required flags.

### Missing (verified)
- ❌ Conditional show/hide on form fields (the engine exists for inspection
  questions — not wired to forms); submission management view (list of
  submissions, spam control, success-message/redirect config); file-upload
  field; multi-page forms; captcha/rate-limit hardening on public endpoint
  (rate-limit lib exists — verify coverage).

### Enterprise target model
- Reuse `conditional-logic.ts` for form fields; submissions inbox with
  approve-to-board option; upload field via P9; theming (logo/colors) per form;
  embed snippet.

---

## 3. Docs & e-sign

### Exists today
- Complete ceremony ✅: draft → recipients (ordered, sequential) → field
  placement (x/y/page) → send (real email ✅) → public token signing page →
  signed (base64) → completed; void; full `signEvents` audit; completion PDF
  path stored.

### Half-baked / missing (verified)
- ⚠️ Completed PDF generated but **never surfaced in UI**; email template
  hardcoded.
- ❌ Reminders/expiry escalation for unsigned docs (dueDate exists); recipient
  reassignment/resend; reusable document templates (field layouts); bulk send;
  in-person signing mode; attachment of signed docs to other records (vendor
  contract → vendor) — designed via `entity_links`, unwired.

### Enterprise target model
*Benchmark: DocuSign-lite / Zoho Sign.*
- Template library with saved field layouts + merge fields (name, docNumber);
  reminder sweep (3-day default, configurable) + expiry; reassign/resend;
  signed-PDF tab on the source RecordPanel via `entity_links`; sign-completion
  guards ([blueprint 04 §9](../04-module-relationship-map.md)).

---

## 4. Timesheets / time clock

### Exists today
- Check-in/out with photo capture, badge/PIN shared-device identity ✅, scope
  ladder (workspace/board/task) ✅, duration computed, active-shift endpoint,
  labor-report endpoint, employee Logs tab.

### Missing (verified)
- ❌ Timesheet approval (not an approval-engine subject) and correction flow
  (edit/void a bad punch with audit); overtime/break rules; weekly timesheet
  view (grid per employee); billable flag per log; labor-cost rate on employee
  → cost roll-ups; geofence/kiosk options.

### Enterprise target model
*Benchmark: ClickUp/Harvest + shop-floor T&A.*
- Weekly timesheet grid + manager approval (approval engine, `time_log` batch
  subject); correction requests (employee proposes, manager approves — audit
  kept); overtime policy per workspace; rate-carrying employee profile feeding
  WO labor cost and billable invoicing (link exists in invoice builder).

---

## 5. HR / employees / departments

### Exists today
- Employee master CRUD + detail (overview, skills, logs, photos tabs);
  manager self-FK; departments table + routes; badge/PIN identity; user↔
  employee 1:1 ✅.

### Missing (verified)
- ❌ Onboarding/offboarding workflows (no checklists, no account-deactivation
  tie-in); employee document vault (offer letters, IDs — DocSign reuse
  designed, unwired); org chart from manager hierarchy; department hierarchy/
  cost centers; emergency contacts/bank/benefits sections; employee
  self-service profile edit; headcount/attrition reporting.

### Enterprise target model
*Benchmark: Zoho People core.*
- Employee 360°: profile sections (personal/job/comp-optional/documents/
  skills/shifts/leave/training/assets-assigned/activity); onboarding template →
  board-task checklist (Work OS reuse) triggered by `employee.created`;
  offboarding (asset return, access revocation checklist, archive). Org chart
  view; department tree with cost-center code (feeds GL + scoping).

---

## 6. Leave

### Exists today
- Types/balances/requests with approval engine ✅ (manager routing, balance
  roll-up on approval ✅), cancel, `mine` filter, leave page.

### Missing (verified)
- ❌ Accrual engine (balances manually entitled; no monthly/annual grant cron,
  no carry-over/proration rules); team/workspace leave calendar; covering-
  employee field handoff; half-day/hours units; holiday calendar per workspace
  (affects planning + SLA math); `on_leave` status automation on employee;
  leave→production-capacity feed ([blueprint 04 §3](../04-module-relationship-map.md)).

### Enterprise target model
- Accrual policies per leave type (grant cadence, carry-over cap, proration);
  holiday calendars; calendar view with department filter; conflict warning
  (overlapping team leave); HR analytics (absence rate, balance liability).

---

## 7. Training & certifications

### Exists today
- Courses/lessons CRUD, enrollments with per-lesson progress → 100% emits
  `course.completed` → **auto-mints certification records** ✅; certifications
  register; expiry sweep service written.

### Missing (verified)
- ❌ Assessments/quizzes (completion = clicked-through); certificate PDF
  (record exists, no document); expiry sweep not scheduled in cron; cert-gated
  work assignment (guard designed, unwired); training matrix (role ×
  required courses × status — the compliance artifact auditors ask for);
  external training records upload; refresher auto-enrollment on expiry.

### Enterprise target model
*Benchmark: TalentLMS-lite + compliance matrix.*
- Quiz lesson type (pass mark, attempts); certificate PDF via pdfTemplates +
  optional DocSign signature; required-training rules (role/department →
  courses) driving the matrix report + auto-enrollment; expiry pipeline:
  sweep → `certification.expiring` → notify + auto-enroll refresher →
  assignment guards block uncertified work.

---

## 8. Approvals engine (platform)

### Exists today
- Polymorphic requests/steps ✅, multi-step with role fallback, decide
  endpoint, approvals inbox page, `runApprovalSubjectSync` mutating PO/vendor/
  expense/leave ✅.

### Missing (verified)
- ❌ `approvalPolicies` never consulted (steps built ad-hoc per module); SLA/
  escalation/delegation ([blueprint 05 §2](../05-workflow-architecture.md));
  subjects: SO, requisition, WO, maintenance, ECR (has own decide), credit
  note, JE, timesheets; bulk approve; approval widget on document pages (today
  only the inbox shows state); email actions (approve from email).

---

## 9. Notifications & activity

### Exists today
- In-app notifications + per-user/type preferences tables ✅; consumer fan-out;
  activity feed read model with board/item timelines ✅.

### Missing (verified)
- ❌ Preferences UI (table has no page); email channel routing incomplete;
  workspace-broadcast default too noisy (no watchers/owner targeting); digests;
  mention-specific events; workspace-level activity page (API exists).

---

## 10. Reports & analytics (platform)

### Exists today
- `/api/reports/summary` (cross-module KPIs), item 360° finance roll-up ✅,
  trial balance, labor report, emp-reports; reports hub page + home widgets.

### Missing (verified)
- ❌ Saved/custom reports; date-range/filter params on most reports; export
  (CSV/PDF) of report output; scheduled email delivery; drill-down from number
  → records; per-suite hubs ([blueprint 06 §5](../06-enterprise-readiness.md));
  chart visualizations (numbers only).

---

## 11. Platform: workspaces, members, invitations, data-io, localization

### Exists today
- Workspace CRUD + localization (country/locale/timezone/currency/fiscal
  year) ✅ + terminology relabeling ✅ (genuinely differentiating); member
  add/remove with 11 `canAccess*` flags; invitation tokens + email; CSV
  import/export registry (~10 master entities); link-policies API.

### Missing (verified)
- ❌ Member-permission admin UI (flags edited how? — needs settings screen);
  invitation acceptance page incomplete; workspace branding (logo for PDFs/
  portal/emails); audit-log viewer for admins; data-io: documents-with-lines,
  validation preview, mapping, XLSX (P11); link-policies admin UI (API only);
  UI translation layer (locale stored, app English-only); session/device
  management; 2FA.

### Enterprise target model
- Settings hub: General (branding, locale, currency, fiscal) / Members & roles
  (permission-set editor per [blueprint 02 §3](../02-product-architecture.md)) /
  Terminology / Numbering (document_sequences editor) / Tax rates / Approvals
  (policy editor) / Link policies / Notifications / Data (import/export,
  backups) / API & webhooks (Phase 4). Invitation acceptance + SSO later.

---

## 12. Global search

Does not exist in any form. Target: ⌘K palette — workspace-scoped Postgres
FTS across masters + documents (name/docNumber/description), type-ahead,
recent items, actions ("new invoice") — [blueprint 07 §4](../07-ui-ux-design-system.md).
