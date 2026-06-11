# BRD: Expense Management Module

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

Expense Management lets employees submit business expenses (with receipts), routes
them through approval, and tracks reimbursement and accounting. It connects People
(who spent), Approvals (sign-off), Finance (reimburse/post), and optionally
Projects (cost allocation).

## 2. Business Objectives

- Simple, mobile-friendly expense capture with receipts
- Enforce policy (categories, limits, required receipts)
- Governed multi-step approval
- Timely, traceable reimbursement
- Allocate cost to projects/cost centres
- Audit-ready expense records

## 3. Target Users

Employees · managers/approvers · finance/AP · project managers · auditors.

## 4. User Roles

Expense Admin · Employee (claimant) · Manager/Approver · Finance User · Auditor ·
Viewer.

## 5. Feature Scope

Expense claim · line items by category · receipt upload (OCR advanced) · policy
checks · approval workflow · reimbursement · project/cost-centre allocation ·
mileage (advanced) · advances (advanced) · corporate card import (advanced) ·
reports · audit.

## 6. Default Features

- **Create claim** — title, date, currency; one or more lines (category, amount,
  tax, description, receipt attachment).
- **Submit for approval** — routes to manager/approver.
- **Approve / reject** — with comments; multi-line partial approval (advanced).
- **Reimbursement** — mark reimbursed / create payable; record method & date.
- **Statuses** — draft → submitted → approved → rejected → reimbursed.
- **Lists & search** — by employee/status/date/category; export.

## 7. Advanced Features

- **Policy engine** — per-category limits, daily caps, receipt-required rules,
  auto-flag violations.
- **Multi-step / amount-threshold approvals**.
- **Receipt OCR** auto-fill.
- **Mileage / per-diem** calculators.
- **Cash advances** and settlement.
- **Corporate card feed** import & matching.
- **Project / cost-centre allocation & billable expenses** (re-bill to customer).
- **Multi-currency** with conversion.

## 8. Key Workflows

**Claim → reimburse** → employee creates claim + receipts → submit
(`expense.submitted`) → `approval.requested` → approver approves
(`expense.approved`) → finance reimburses (`expense.reimbursed`) → optional AP
payable. Rejection emits `expense.rejected` back to employee.

**Billable expense** → flag line billable → on approval, link to customer/SO →
available to add on next invoice.

## 9. Screens / Pages Required

Expense List · Create/Edit Claim · Claim Detail (lines, receipts, approvals,
activity) · Approval Queue · Reimbursement queue (Finance) · Expense Reports ·
Expense Settings.

## 10. Key Data Fields

**Claim** — id, number, employeeId, status, currency, total, submitted/approved/
reimbursed dates, approverId, `workspaceId`.

**Line** — id, claimId, category, date, amount, tax, description, receipt file,
projectId/costCentre, billable flag.

**Reimbursement** — id, claimId, method, reference, amount, date.

## 11. Business Rules

- Receipt required above a configurable amount per category.
- Claim total = Σ approved lines.
- Only `approved` claims are reimbursable.
- Policy violations flagged (block or warn per config).
- Employee can edit only `draft`/`rejected` claims.
- Billable lines must reference a customer/SO/project.

## 12. Permissions

view own/team expenses · create claim · submit · approve · reject · reimburse ·
manage policies · view all expenses · export · manage settings.

## 13. Notifications & Alerts

Claim submitted/needs approval · approved/rejected · reimbursed · policy
violation · pending approval reminder · advance settlement due.

## 14. Reports & Dashboards

**Widgets:** pending approvals · awaiting reimbursement · expenses MTD · top
categories · policy violations.

**Reports:** expense register · by employee/category/project · reimbursement
status · policy-violation report · billable-expense report.

## 15. Configuration Settings

Claim numbering · categories · policy limits & receipt rules · approval workflow
& thresholds · reimbursement methods · project/cost-centre list · currencies ·
notifications · `link_policies`.

## 16. Audit Trail Requirements

Claim/line field-level history; submission, approval, rejection, reimbursement
events (who/when/amount); receipt uploads; policy-violation flags; activity-feed
entry per event.

## 17. MVP Scope

Claim with lines & receipts · submit · approve/reject · reimburse · statuses ·
lists/export · permissions · audit. *(Live: `/dashboard/expenses`.)*

## 18. Future / Advanced Scope

Policy engine · multi-step approvals · OCR · mileage/per-diem · advances · card
feed · project allocation & billable re-invoice · multi-currency.

## 19. Interoperability & Integration

Expenses ties **People → Approvals → Finance** (and optionally Sales/Projects for
billable re-invoicing).

**Aggregate type:** `expense`.

**Events emitted**

| Event | When | Payload |
|-------|------|---------|
| `expense.submitted` | claim submitted | claimId, employeeId, total |
| `expense.approved` / `expense.rejected` | approval resolved | claimId, approverId |
| `expense.reimbursed` | paid out | claimId, amount, method |
| `approval.requested` | on submit | aggregate `expense`, claimId |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Approvals | `approval.approved/rejected` (target expense) | set claim approved/rejected |
| Invoicing | `payment.recorded` (reimbursement) | mark `expense.reimbursed` |

**Shared entities & links** — references `employee` (FK). Billable lines link to
`customer`/`sales_order`/project via `entity_links` (`expense charged_to …`) so
Sales/Invoicing can re-bill. Approved expenses can create an AP-style payable in
Invoicing.

**Scope ladder** — claims attach at workspace rung by default; billable/project
expenses attach at the board/project rung for project-cost roll-ups.

**Idempotency** — reimbursement keyed on claimId; `expense.approved` keyed on
(claimId, approvalId).
