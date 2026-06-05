# BRD: Approvals Module (Cross-cutting)

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

Approvals is a **shared, cross-cutting workflow service**, not a siloed feature.
Any module (Purchasing, Expenses, Vendor onboarding, Sales orders, Invoices,
Leave, Quality CAPA…) raises an approval request against one of its records; the
service routes it to approvers per configurable rules, records the decision, and
the originating module reacts. One mechanism, every module.

## 2. Business Objectives

- Consistent, governed sign-off across all modules
- Configurable routing (role, hierarchy, amount thresholds, multi-step)
- Clear accountability and a single approvals inbox
- Faster cycle times with reminders/escalation
- Complete, audit-ready decision history

## 3. Target Users

Approvers/managers · requesters (any module) · admins configuring rules ·
auditors.

## 4. User Roles

Approval Admin · Approver · Requester · Delegate · Auditor · Viewer.

## 5. Feature Scope

Approval requests (any aggregate) · single & multi-step chains · parallel/serial
steps · rule-based routing · thresholds · delegation · reminders & escalation ·
approvals inbox · decision history · audit.

## 6. Default Features

- **Raise request** — module calls the service with `{aggregateType,
  aggregateId, type, amount?, requestedBy}`.
- **Single-step approval** — route to a role/user; approve or reject + comment.
- **Approvals inbox** — unified list of items awaiting *me*, across modules.
- **Decision capture** — approver, timestamp, comment, outcome.
- **Status** — pending → approved / rejected / cancelled.
- **Notifications** — request raised, decision made.

## 7. Advanced Features

- **Multi-step chains** (serial) and **parallel approvals** (N-of-M).
- **Rule engine** — route by amount threshold, department, category, vendor,
  workspace.
- **Delegation / out-of-office** with auto-reassign.
- **Escalation & SLA** — auto-escalate after X hours; reminders.
- **Conditional auto-approve** below thresholds.
- **Re-approval on change** (if amount/scope changes after submission).
- **Approval policies versioning** & simulation.

## 8. Key Workflows

**Generic approval** → module emits `approval.requested` (aggregate = the source
record) → service resolves route → approver(s) notified → approve/reject →
service emits `approval.approved` / `approval.rejected` → **source module
consumes it** and transitions its record (PO→approved, expense→approved,
vendor→active, SO→approved, leave→approved…).

**Multi-step** → step 1 approves → advances to step 2 → … → final decision emits
the terminal event.

**Escalation** → no action within SLA → reassign/notify next level.

## 9. Screens / Pages Required

Approvals Inbox (my pending) · Request Detail (context + history + actions) · All
Requests (admin) · Approval Rules/Workflows config · Delegation settings ·
Approval Reports.

## 10. Key Data Fields

**Approval request** — id, aggregateType, aggregateId, type, status, amount,
currency, requestedBy, requestedAt, workspaceId, current step.

**Approval step** — id, requestId, sequence, approverRole/userId, status,
decidedBy, decidedAt, comment.

**Rule** — id, module, conditions (amount/dept/category), step definition,
escalation/SLA.

## 11. Business Rules

- A request references exactly one source aggregate (typed).
- Terminal decision emits exactly one `approval.approved` **or**
  `approval.rejected`.
- Multi-step: all required steps must approve; any reject terminates.
- An approver cannot approve their own request (segregation of duties, config).
- Routing resolved at submission from current rules (versioned).
- Cancelled source record cancels the open approval.

## 12. Permissions

view own approvals · act on assigned approvals · view all (admin) · configure
rules · manage delegation · export.

## 13. Notifications & Alerts

Approval requested (to approver) · approved/rejected (to requester) · reminder ·
escalation · delegated/reassigned.

## 14. Reports & Dashboards

**Widgets:** my pending · pending by module · avg approval time · overdue/escalated.

**Reports:** approval cycle-time · approvals by module/approver · rejection
reasons · SLA breaches · delegation log.

## 15. Configuration Settings

Per-module approval rules · thresholds · step chains (serial/parallel) · SLA &
escalation · delegation · segregation-of-duties rules · notifications.

## 16. Audit Trail Requirements

Full request lifecycle; each step's approver/decision/time/comment; routing
applied; escalations; delegations; activity-feed entry per event. Decision
history is immutable.

## 17. MVP Scope

Generic request against any aggregate · single-step routing by role · inbox ·
approve/reject + comment · terminal events consumed by source modules ·
notifications · audit. *(Live: `src/lib/services/approvals.ts`,
`/dashboard/approvals`.)*

## 18. Future / Advanced Scope

Multi-step/parallel chains · rule engine · delegation/OOO · escalation/SLA ·
auto-approve · re-approval on change · policy versioning/simulation.

## 19. Interoperability & Integration

Approvals is **pure interoperability** — it exists to coordinate other modules.

**Aggregate type:** `approval_request` (and it references *any* other aggregate).

**Events emitted**

| Event | When | Payload |
|-------|------|---------|
| `approval.requested` | request raised | requestId, aggregateType, aggregateId, type, amount |
| `approval.approved` | terminal approve | requestId, aggregateType, aggregateId, approverId |
| `approval.rejected` | terminal reject | requestId, aggregateType, aggregateId, reason |

**Events consumed** — the *source-module* "submit" events that imply approval, or
the module calls the service directly. Each source module **consumes the terminal
event** filtered by `aggregateType`:

| Source module | Listens for | Transition on approve |
|---------------|-------------|-----------------------|
| Purchasing | `approval.*` where aggregate `purchase_order` | PO → approved/rejected |
| Expenses | aggregate `expense` | claim → approved/rejected |
| Vendor | aggregate `vendor` | vendor → active/rejected |
| Sales | aggregate `sales_order` | SO → approved |
| Invoicing | aggregate `invoice` | bill released for payment |
| HR/Leave | aggregate `leave_request` | leave → approved/rejected |
| Quality | aggregate (CAPA/NCR) | action → approved/closed |

**Shared mechanism** — because the aggregate is generic, adding approval to a new
module needs **no change to Approvals**: the module emits `approval.requested`
with its aggregate type and consumes the terminal event. This is the canonical
example of the platform's "emit, don't call" rule.

**Scope ladder** — a request inherits the scope of its source record, so the
approvals inbox and reports can be filtered by workspace/board/project.

**Idempotency** — terminal events keyed on requestId; consumers guard against
double-transition by checking current source-record status.
