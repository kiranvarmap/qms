# BRD: HR, Employees & Leave Module

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

This module owns the **people master** (employees), their attendance/time, and
leave management. It is the identity backbone for labor costing, training,
expenses, approvals, and shop-floor work, and it unifies office and shop-floor
(badge/PIN `worker`) identities.

## 2. Business Objectives

- Single employee master linked to platform `users`
- Track attendance/time (clock in/out, work time)
- Manage leave (balances, requests, approvals, calendar)
- Feed labor cost onto jobs/items
- Support compliance (documents, certifications via Training)
- Provide HR visibility and reports

## 3. Target Users

HR team · managers/supervisors · employees (self-service) · shop-floor workers ·
finance (labor cost) · auditors.

## 4. User Roles

HR Admin · Manager/Supervisor · Employee (self-service) · Worker (badge/PIN) ·
Finance · Auditor · Viewer.

## 5. Feature Scope

Employee master · departments/teams · attendance & time clock · work-time logs ·
leave types & balances · leave requests & approval · leave calendar · documents ·
onboarding/offboarding (advanced) · shift scheduling (advanced) · payroll export
(advanced) · reports · audit.

## 6. Default Features

- **Employee master** — name, code, contact, department, role/designation, manager,
  join date, status; 1:1 link to a platform `user`; `worker` identities for
  shop-floor (badge/PIN).
- **Time clock / attendance** — check in/out; work-time logs per day/job.
- **Leave types** — e.g. annual, sick, unpaid; balance per employee.
- **Leave request** — type, dates, reason; submit for approval.
- **Leave approval** — manager approve/reject; balance updated.
- **Leave calendar** — team view of who's off.
- **Self-service** — employee profile, leave balance, request history.

## 7. Advanced Features

- **Shift scheduling & rosters**.
- **Accrual policies** (auto-accrue leave; carry-over; pro-rate).
- **Onboarding/offboarding checklists** (tasks via boards).
- **Document management** (contracts, IDs) with expiry.
- **Statutory work-authorization & compliance** — the required document set is
  **country-driven** (e.g. US **I-9 / work authorization**, EU right-to-work,
  India PF/ESI ids); see [00 §12](00-platform-interoperability.md). Mechanics
  (capture, verify, expiry, re-verify) are identical across countries.
- **Payroll export / integration** (country-aware statutory fields).
- **Overtime & timesheet approval**.
- **Org chart**; multi-site/department hierarchy.
- **Geo/biometric attendance**.

## 8. Key Workflows

**Leave request** → employee submits (`leave.requested`) → `approval.requested` →
manager approves (`leave.approved`) → balance decremented → calendar updated.
Rejection emits `leave.rejected`.

**Attendance** → worker checks in (`timelog.checked_in`) → checks out
(`timelog.checked_out`) → work-time rolled up onto linked item/job (labor loop).

**Onboarding (advanced)** → create employee → trigger onboarding board tasks +
assign training courses (`course.assigned`).

## 9. Screens / Pages Required

Employee List · Create/Edit Employee · Employee Detail (profile, leave,
attendance, training, documents) · Time Clock · Work-Time logs · Leave Requests ·
Leave Approval Queue · Leave Calendar · **Self-service** profile · HR Reports ·
HR Settings.

## 10. Key Data Fields

**Employee** — id, code, userId (FK to `users`), name, contact, department,
designation, managerId, join date, status, identity type (user/worker),
`workspaceId`.

**Leave type** — id, name, accrual rule, paid flag.

**Leave balance** — id, employeeId, typeId, entitled, taken, remaining, period.

**Leave request** — id, employeeId, typeId, start, end, days, reason, status,
approverId.

**Time log** — id, employeeId, check-in, check-out, duration, boardId/groupId/
itemId (scope), `workspaceId`.

## 11. Business Rules

- One employee ↔ one platform `user` (or a `worker` badge/PIN identity).
- Leave request days cannot exceed remaining balance (unless unpaid/override).
- Overlapping approved leave blocked (config).
- Time log check-out must be after check-in; open logs flagged.
- Attendance/leave scoped to workspaces the employee belongs to.
- Inactive employees cannot submit new requests or clock in.

## 12. Permissions

view own / team / all employees · create/edit employee · manage leave types ·
approve leave · view attendance · manage shifts · export payroll · manage
settings.

## 13. Notifications & Alerts

Leave requested/approved/rejected · leave balance low · missing clock-out ·
upcoming leave (team) · document/certification expiring · shift assigned ·
onboarding task due.

## 14. Reports & Dashboards

**Widgets:** on leave today · pending leave approvals · headcount · attendance %
· open time logs.

**Reports:** leave balance & ledger · attendance/timesheet · labor hours by
job/item · headcount/turnover · document/certification expiry.

## 15. Configuration Settings

Departments/teams · designations · leave types & accrual · holidays/calendar ·
shift patterns · attendance rules · approval routing · `link_policies` for time
logs (scope rung) · notifications.

## 16. Audit Trail Requirements

Employee field-level history; leave request lifecycle (who/when/decision);
balance adjustments; attendance edits; identity links; activity-feed entry per
event.

## 17. MVP Scope

Employee master (+user link, worker identities) · time clock/attendance ·
work-time logs · leave types/balances · leave request & approval · leave calendar
· self-service · reports · permissions · audit. *(Live: `/dashboard/{employees,
hr,leave,time-clock,work-time}`, `time_logs` schema, labor loop in
`consumers.ts`.)*

## 18. Future / Advanced Scope

Shift scheduling · accrual automation · onboarding/offboarding · document mgmt ·
payroll integration · overtime/timesheet approval · org chart · geo/biometric.

## 19. Interoperability & Integration

HR is the **identity & labor backbone** that other modules attribute work, cost,
and training to.

**Aggregate types:** `leave_request`, `time_log` (employee master via `employee`/
`users`).

**Events emitted**

| Event | When | Payload |
|-------|------|---------|
| `leave.requested` | leave submitted | requestId, employeeId, dates |
| `leave.approved` / `leave.rejected` | decision | requestId, approverId |
| `timelog.checked_in` / `timelog.checked_out` | attendance | logId, employeeId, itemId? |
| `approval.requested` | on leave submit | aggregate `leave_request` |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Approvals | `approval.approved/rejected` (target leave) | set leave approved/rejected, adjust balance |
| Training | `certification.expiring` | flag employee for re-training |
| Production *(planned)* | `workorder.assigned` | attribute labor/time to the work order |

**Shared entities & links** — `employee.userId` unifies identity with platform
`users` (used by Approvals, Expenses, Quality sign-offs, activity actor). Time
logs carry scope ancestry (`boardId/groupId/itemId`) so the **labor loop** rolls
hours/cost onto the linked item/job. Training enrollments and certifications link
to `employee`.

**Scope ladder** — time logs attach at the `item` rung (job/task) per
`link_policies`; employee master is workspace-scoped.

**Idempotency** — leave decisions keyed on requestId; labor roll-ups recomputed
from `timelog.*` events (safe to re-deliver). `timelog.checked_out` is the
roll-up trigger.
