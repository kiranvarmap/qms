# BRD: Invoicing & Books (Accounting) Module

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

This module covers **billing and money**: customer invoices (AR) generated from
sales, vendor bills (AP) generated from purchasing, recording payments, and the
lightweight books (ledgers, taxes, aging) that summarise them. It is the
financial sink of both the quote-to-cash and procure-to-pay loops.

> Payments are **manual record-keeping** by default (mark-as-paid / record
> payment), not an online payment gateway. Gateway integration is advanced scope.

## 2. Business Objectives

- Bill customers accurately and on time (AR)
- Capture and pay vendor bills correctly (AP)
- Track outstanding receivables/payables and aging
- Apply taxes consistently per the workspace's country tax regime (US sales tax,
  VAT, GST, …) — see [00 §12](00-platform-interoperability.md)
- Provide audit-ready financial records
- Feed management with cash and revenue visibility

## 3. Target Users

Finance/accounts team · AR clerks · AP clerks · controllers · auditors ·
management · customers (portal, view/pay).

## 4. User Roles

Finance Admin · AR User · AP User · Approver · Controller · Auditor · Customer
(portal) · Viewer.

## 5. Feature Scope

AR invoices · AP bills · credit notes / debit notes · payments (record) ·
part-payments & allocation · taxes · multi-currency (advanced) · recurring
invoices (advanced) · statements · aging · chart of accounts & ledgers
(advanced) · bank reconciliation (advanced) · reports · audit.

## 6. Default Features

- **AR invoice** — from a sales order/shipment or standalone; lines (product,
  qty, price, tax), totals, due date, terms; auto-numbered; PDF; send by email/
  portal.
- **AP bill** — from a PO/GRN (3-way match) or standalone; vendor, lines, taxes,
  due date.
- **Record payment** — against invoice/bill; date, method, reference, amount;
  supports partial; updates balance & status.
- **Statuses** — draft → sent → partially paid → paid → overdue → void.
- **Credit notes** — issue against an invoice; apply to balance.
- **Taxes** — per-line tax codes; tax summary on document.
- **Aging** — AR/AP aging buckets (current/30/60/90+).
- **Lists & search** — by customer/vendor/status/date; export.

## 7. Advanced Features

- **Recurring invoices / subscriptions**.
- **Multi-currency** with FX gain/loss.
- **Online payment gateway** (customer pays from portal).
- **Chart of accounts, journals, general ledger, trial balance**.
- **Bank feeds & reconciliation**.
- **Tax returns / e-invoicing / statutory filing helpers** (country-driven —
  e.g. US 1099, EU e-invoice, India e-invoice/IRN & GSTR).
- **Dunning** (automated overdue reminders & escalation).
- **Revenue recognition schedules**.
- **Write-offs & bad-debt handling**.

## 8. Key Workflows

**AR: order → cash** → SO ships (`salesorder.invoiced`) → invoice created
(`invoice.created`) → sent (`invoice.sent`) → customer pays → record payment
(`payment.recorded`) → status `paid` (`invoice.paid`). Overdue sweep emits
`invoice.overdue`.

**AP: bill → pay** → GRN + vendor invoice → 3-way match → bill created → approve
(`approval.requested`/`approved`) → record payment (`payment.recorded`).

**Credit note** → issue against invoice → reduce balance / refund.

**Overdue** → scheduled job (`overdue.ts`) flags past-due invoices →
`invoice.overdue` → reminders.

## 9. Screens / Pages Required

Invoice List (AR) · Create/Edit Invoice · Invoice Detail · Bill List (AP) ·
Create/Edit Bill · Payments (record + history) · Credit Notes · AR/AP Aging ·
Statements · **Portal:** invoice view/pay · Books/Ledgers (advanced) · Finance
Reports · Finance Settings.

## 10. Key Data Fields

**Invoice (AR/AP)** — id, number, kind (AR/AP), customerId/vendorId, sourceRef
(soId/poId), status, currency, issue date, due date, subtotal, tax, total,
amount paid, balance, `workspaceId`.

**Invoice line** — id, invoiceId, productId/itemId, description, qty, unit price,
tax code, tax amount, line total.

**Payment** — id, invoiceId(s), date, method, reference, amount, allocation,
recorded by.

**Credit note** — id, number, invoiceId, amount, reason, status.

**Tax code** — id, name, rate, type (resolved by the workspace country tax
regime — sales tax / VAT / GST / …), region/state (for sub-national tax).

## 11. Business Rules

- Invoice number unique per workspace (document-sequence).
- Invoice total = Σ lines + tax − discount; balance = total − payments.
- A payment cannot exceed the open balance (overpayment → credit, advanced).
- Status auto-updates: sent → partially paid → paid; past due-date → overdue.
- AP payment blocked until 3-way match passes (when enabled).
- Void only allowed before payment; otherwise use a credit note.
- Posting to ledgers (advanced) is double-entry and immutable once posted.
- Tax computed per line tax code; rounding per configured rule.

## 12. Permissions

view invoices · create/edit AR invoice · create/edit AP bill · send invoice ·
record payment · issue credit note · void · approve bill · view financials ·
manage ledgers · export · manage settings.

## 13. Notifications & Alerts

Invoice sent · payment received/recorded · invoice overdue · bill due soon · 3-way
match exception · credit note issued · approval needed (AP) · dunning reminder.

## 14. Reports & Dashboards

**Widgets:** outstanding AR · outstanding AP · overdue invoices · cash collected
MTD · revenue MTD · top debtors.

**Reports:** AR/AP aging · invoice register · payment register · tax summary/
return · customer statements · vendor statements · revenue report · (advanced)
P&L, balance sheet, trial balance, GL.

## 15. Configuration Settings

Invoice/bill/credit-note numbering · payment terms · tax codes & rules ·
rounding · invoicing trigger policy · overdue thresholds & reminder cadence ·
**workspace country/locale profile** (tax regime, party tax-ID type, currency,
formatting — see [00 §12](00-platform-interoperability.md)) · currencies/FX ·
chart of accounts (advanced) · portal payment settings · notifications ·
`link_policies`.

## 16. Audit Trail Requirements

Invoice/bill field-level history; send events; payment records (who/when/amount/
ref); credit notes; voids; approval decisions; ledger postings (immutable);
activity-feed entry per event.

## 17. MVP Scope

AR invoices (from SO or standalone) · AP bills (from PO/GRN) · send (PDF/email/
portal) · record payment (partial) · credit notes · taxes · aging · overdue
detection · lists/export · permissions · audit.
*(Live: `src/lib/services/{invoices,overdue}.ts`, `/dashboard/invoices`,
`/portal/invoices`.)*

## 18. Future / Advanced Scope

Recurring invoices · multi-currency FX · payment gateway · full books (CoA/GL/
trial balance) · bank reconciliation · country-specific e-invoicing/statutory
filing · dunning · revenue
recognition · write-offs.

## 19. Interoperability & Integration

Invoicing is the **financial settlement layer** for both business loops.

**Aggregate types:** `invoice`, `payment`.

**Events emitted**

| Event | When | Payload |
|-------|------|---------|
| `invoice.created` | AR/AP invoice generated | invoiceId, kind, customer/vendorId, sourceRef |
| `invoice.sent` | issued to customer | invoiceId |
| `invoice.paid` | balance cleared | invoiceId |
| `invoice.overdue` | past due-date (overdue sweep) | invoiceId, daysOverdue |
| `payment.recorded` | payment posted | paymentId, invoiceId, amount |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Sales | `salesorder.invoiced` | create AR invoice for the SO/shipment |
| Purchasing | `po.received` + matched vendor invoice | create AP bill |
| Approvals | `approval.approved` (target invoice/bill) | release for payment |
| Expenses | `expense.approved` | create reimbursable payable |

**Shared entities & links** — references `customer`/`vendor` and `product/item`.
Invoice ↔ sales_order/purchase_order via `entity_links` (`invoice bills …`),
enabling 3-way match (AP) and order-to-cash tracing (AR). Payment links to one or
many invoices (allocation).

**Scope ladder** — invoices inherit the scope of their source SO/PO (e.g. a job/
board) for project profitability roll-ups.

**Idempotency** — `invoice.created` keyed on (sourceType, sourceId) so a
re-delivered `salesorder.invoiced` won't double-invoice; `payment.recorded` keyed
on paymentId.

**Downstream** — `invoice.paid` updates Sales (close SO, release credit hold) and
Vendor (AP spend/history); the activity feed and Reports consume all finance
events for cash/revenue dashboards.
