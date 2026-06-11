# BRD: Purchase Management Module

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

Purchase Management runs the procure-to-receive flow: turning a need (requisition
or reorder) into a Purchase Order to an approved vendor, getting it approved and
sent, receiving goods against it (Goods Receipt), and handing off to inventory
and accounts payable. It is the operational bridge between Vendor, Inventory, and
Finance.

## 2. Business Objectives

- Control spend with governed PO approval
- Buy from approved vendors at agreed terms
- Receive accurately against POs (3-way match readiness)
- Raise inventory automatically on receipt
- Feed AP with matched bills
- Give visibility of open commitments and lead times

## 3. Target Users

Buyers · procurement managers · plant/warehouse receiving · finance/AP ·
requesters across departments · auditors.

## 4. User Roles

Procurement Admin · Buyer · Requester · PO Approver · Receiving Clerk · Finance/AP
· Auditor · Viewer.

## 5. Feature Scope

Purchase requisition (advanced) · Purchase Order · multi-line items ·
vendor/terms selection · approval workflow · PO send (email/portal/PDF) · goods
receipt (full/partial) · returns to vendor · 3-way match · blanket/contract POs
(advanced) · drop-ship (advanced) · landed cost (advanced) · reports · audit.

## 6. Default Features

- **Create PO** — select vendor, currency, terms; add item lines (item, qty,
  unit price, tax, expected date); auto-numbered (document-sequence); totals.
- **PO statuses** — draft → pending approval → approved → sent → partially
  received → received → closed → cancelled.
- **Approval** — submit for approval; approver approves/rejects with comment.
- **Send PO** — generate PDF, email to vendor, mark sent.
- **Goods receipt (GRN)** — receive against PO lines, full or partial; record
  received qty, date, location; auto-raise inventory.
- **PO list & search** — by vendor/status/date; open-PO view; export.

## 7. Advanced Features

- **Purchase requisition → PO** with requisition approval.
- **Reorder-driven POs** — generate from `stock.low` / min-max planning.
- **3-way match** — PO ↔ GRN ↔ vendor invoice with tolerance rules; block/flag
  mismatches before payment.
- **Blanket / contract POs** with release scheduling.
- **Returns / debit notes** to vendor.
- **Landed cost** allocation (freight, duty) into item cost.
- **Drop-ship POs** linked to a sales order.
- **Budget checks** at PO creation.
- **Multi-currency** with FX at PO/receipt/invoice.

## 8. Key Workflows

**Create & approve PO** → new PO → vendor + lines → submit → `po.submitted` →
`approval.requested` → approver approves → `po.approved` → send → `po.sent`.

**Receive goods** → open PO → GRN → enter received qty/location → post →
`goods_receipt` + `po.received` → inventory raised (`stock.received`) → PO status
updated (partial/received).

**3-way match → bill** → vendor invoice arrives → match to PO+GRN within
tolerance → on match, create AP `invoice.created` → route to payment.

**Reorder loop** → `stock.low` consumed → suggested PO drafted for buyer.

## 9. Screens / Pages Required

PO List · Create/Edit PO · PO Detail (lines, approvals, receipts, invoices,
activity) · Approval Queue · Goods Receipt (create + history) · Requisitions
(advanced) · Returns (advanced) · 3-Way Match workbench (advanced) · Purchasing
Reports · Purchasing Settings.

## 10. Key Data Fields

**PO** — id, PO number, vendorId, status, currency, payment terms, order date,
expected date, subtotal, tax, total, created by, approver, `workspaceId`,
links (sales_order for drop-ship).

**PO line** — id, poId, itemId/productId, description, qty ordered, qty received,
unit price, tax, line total, expected date.

**Goods receipt (GRN)** — id, grnNumber, poId, vendorId, receipt date, received
by, location/warehouse, status.

**GRN line** — id, grnId, poLineId, itemId, qty received, lot/serial (if
tracked), QC status.

## 11. Business Rules

- PO requires an `active` vendor and at least one line.
- PO must be `approved` before it can be sent; `sent` before goods are received
  (configurable).
- Received qty per line cannot exceed ordered qty + over-receipt tolerance.
- Receipt posts inventory atomically with `stock.received`.
- AP payment blocked until 3-way match passes (when enabled).
- Cancelled PO cannot be received; partially-received PO cannot be deleted.
- Spend over a threshold escalates approval level (advanced).

## 12. Permissions

view PO · create/edit PO · submit PO · approve PO · send PO · receive goods ·
return goods · match invoices · manage settings · export.

## 13. Notifications & Alerts

PO submitted/needs approval · approved/rejected · PO sent · goods received
(partial/full) · over/under receipt · 3-way match exception · expected date
overdue · reorder suggestion.

## 14. Reports & Dashboards

**Widgets:** open POs · POs awaiting approval · receipts due · overdue
deliveries · spend MTD · top vendors.

**Reports:** purchase register · open-PO / commitment report · receipt history ·
3-way match exceptions · vendor lead-time · price variance · spend analysis.

## 15. Configuration Settings

PO/GRN numbering · approval thresholds & steps · over-receipt tolerance · match
tolerances · default terms · required fields · budget rules · landed-cost rules ·
notifications · `link_policies`.

## 16. Audit Trail Requirements

PO field-level history; approval decisions; send events; receipts (who/when/qty);
match results; cancellations; activity-feed entry per event.

## 17. MVP Scope

PO create/edit · lines · vendor/terms · approval · send (PDF/email) · goods
receipt (full/partial) → inventory raise · PO list/search/export · permissions ·
audit. *(Live: `src/lib/services/purchasing.ts`, `/dashboard/purchase-orders`.)*

## 18. Future / Advanced Scope

Requisitions · reorder-driven POs · 3-way match · blanket/contract POs · returns/
debit notes · landed cost · drop-ship · budget checks · multi-currency FX.

## 19. Interoperability & Integration

Purchasing is the **engine of the procure-to-stock loop**, sitting between Vendor
(upstream) and Inventory + Finance (downstream).

**Aggregate types:** `purchase_order`, `goods_receipt`.

**Events emitted**

| Event | When | Payload |
|-------|------|---------|
| `po.submitted` | sent for approval | poId, vendorId, total |
| `po.approved` / `po.rejected` | approval resolved | poId, approverId |
| `po.sent` | issued to vendor | poId, vendorId |
| `po.received` | goods receipt posted | poId, grnId, lines[] |
| `stock.received` | per received line | itemId, qty, grnId |
| `approval.requested` | on submit | aggregate `purchase_order`, poId |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Inventory | `stock.low` | draft reorder PO (advanced) |
| Approvals | `approval.approved/rejected` (target PO) | set PO approved/rejected |
| Vendor | vendor `on-hold`/`blocked` status | prevent new POs to that vendor |
| Sales | `salesorder.approved` (drop-ship) | create linked drop-ship PO |
| Invoicing | AP `invoice` matched | close PO financially |

**Shared entities & links** — references `vendor` (FK) and `item/product` (FK on
lines). GRN links PO ↔ inventory receipt; PO ↔ sales_order via `entity_links`
(`po fulfills sales_order`) for drop-ship; PO ↔ AP invoice via `entity_links`
(`invoice bills purchase_order`) for 3-way match.

**Scope ladder** — POs are workspace-scoped; can attach to a board/project rung
when buying for a specific job (`link_policies` decides optional/required).

**Idempotency** — receipts dedupe on `(poLineId, grnLineId)` so re-delivered
`po.received` never double-raises stock; `po.approved` keyed on poId+approval.

**Failure handling** — if the inventory consumer fails, the outbox retries
(`stock.received` is idempotent), so receipts and on-hand stay consistent.
