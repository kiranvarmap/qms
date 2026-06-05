# BRD: Sales Module (Estimates · Sales Orders · Shipments)

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

The Sales module runs **quote-to-fulfilment**: building customer estimates/quotes,
converting accepted ones into Sales Orders, allocating and shipping stock, and
handing off to Invoicing. It includes a customer-facing portal surface for
estimate viewing/acceptance and order status.

## 2. Business Objectives

- Produce professional, accurate quotes fast
- Convert quotes to orders with no re-keying
- Reserve and ship stock reliably (no overselling)
- Give customers self-service visibility (portal)
- Feed Invoicing/AR cleanly (order-to-cash)
- Track pipeline, conversion, and fulfilment performance

## 3. Target Users

Sales reps · sales ops · order desk · warehouse/shipping · finance/AR · customers
(portal) · management.

## 4. User Roles

Sales Admin · Sales Rep · Order Manager · Shipping Clerk · Finance/AR · Customer
(portal contact) · Viewer.

## 5. Feature Scope

Customer master link · estimates/quotes · quote PDF & send · portal accept/reject
· estimate → sales order conversion · sales order management · stock reservation ·
pricing & discounts · taxes · shipments (pick/pack/ship/deliver) · partial
shipments · backorders (advanced) · returns/RMA (advanced) · invoicing handoff ·
reports · audit.

## 6. Default Features

- **Estimate/Quote** — customer, currency, line items (product, qty, price,
  discount, tax), validity date, notes/terms; auto-numbered; totals.
- **Send estimate** — PDF + email; portal link; track viewed/accepted/rejected.
- **Convert to Sales Order** — one click; copies lines; links estimate→SO.
- **Sales Order** — statuses: draft → approved → reserved → partially shipped →
  shipped → invoiced → closed → cancelled.
- **Stock reservation** — on approval, reserve stock for SO lines.
- **Shipment** — create from SO; pick/pack/ship; record carrier/tracking; relieve
  stock; partial shipment supported.
- **Lists & search** — estimates and SOs by customer/status/date; export.

## 7. Advanced Features

- **Backorders & allocation rules** when stock is short.
- **Returns / RMA** with restock and credit-note linkage.
- **Price lists, tiered/volume pricing, promotions**.
- **Credit limit checks** against AR before approval.
- **Recurring orders / subscriptions**.
- **Drop-ship** (creates a linked PO instead of relieving stock).
- **Multi-warehouse fulfilment** & shipment splitting.
- **Configure-to-order / kits / bundles**.
- **Customer portal**: order history, reorder, document download, comments.

## 8. Key Workflows

**Quote → accept** → create estimate → send → `estimate.sent` → customer views
(`estimate.viewed`) → accepts (`estimate.accepted`) → convert
(`estimate.converted`).

**Order → reserve** → SO approved (`salesorder.approved`) → stock reserved
(`stock.reserved`); cancel releases (`stock.reservation_released`).

**Pick → ship** → create shipment → pick (`shipment.picked`) → pack
(`shipment.packed`) → ship (`shipment.shipped`) → stock relieved
(`stock.shipped`) → deliver (`shipment.delivered`).

**Ship → invoice** → on ship/deliver → `salesorder.invoiced` → Invoicing creates
`invoice.created`/`invoice.sent`.

## 9. Screens / Pages Required

Estimate List · Create/Edit Estimate · Estimate Detail · Sales Order List ·
Create/Edit SO · SO Detail (lines, reservations, shipments, invoices, activity) ·
Shipment (create + history) · Customer List/Detail · **Portal:** estimate view/
accept, order status · Sales Reports · Sales Settings.

## 10. Key Data Fields

**Customer** — id, name, code, contacts, billing/shipping addresses, currency,
payment terms, tax id, credit limit, `workspaceId`.

**Estimate** — id, number, customerId, status, currency, valid-until, subtotal,
discount, tax, total, sent/viewed/accepted timestamps, links (→ SO).

**Sales Order** — id, number, customerId, estimateId, status, currency, required
date, subtotal/discount/tax/total, reserved flag.

**SO line** — id, soId, productId, qty ordered/reserved/shipped/invoiced, price,
discount, tax, warehouse.

**Shipment** — id, number, soId, status, carrier, tracking, ship/deliver dates.

## 11. Business Rules

- Estimate must be `accepted` (or manually overridden) to convert to SO.
- SO approval reserves stock; available stock honored (no oversell unless
  backorder enabled).
- Shipment cannot exceed ordered − already-shipped per line.
- Shipping relieves stock atomically with `stock.shipped`.
- Invoicing triggered by shipment/delivery per configured policy.
- Cancelling an SO releases reservations and blocks further shipment.
- Credit-limit breach blocks approval (advanced).

## 12. Permissions

view sales · create/edit estimate · send estimate · convert · create/edit SO ·
approve SO · reserve/allocate · create shipment · ship · process returns · manage
customers · export · manage settings.

## 13. Notifications & Alerts

Estimate sent/viewed/accepted/rejected/expired · SO approved/cancelled · stock
shortage on reserve · shipment shipped/delivered · backorder created · invoice
raised · portal comment added.

## 14. Reports & Dashboards

**Widgets:** open quotes · quote conversion % · open SOs · to-ship today ·
shipped MTD · sales value · top customers/products.

**Reports:** quote register & win/loss · sales order book · fulfilment/backorder
· shipment log · sales by customer/product/rep · returns · revenue (with
Invoicing).

## 15. Configuration Settings

Estimate/SO/shipment numbering · pricing & discount rules · tax rules · validity
defaults · reservation policy · fulfilment/allocation rules · invoicing trigger
(on-ship vs on-deliver vs manual) · portal settings · notifications ·
`link_policies`.

## 16. Audit Trail Requirements

Estimate lifecycle timestamps; SO field-level history; reservation/shipment
events (who/when/qty); cancellations; portal actions; activity-feed entry per
event.

## 17. MVP Scope

Customer link · estimate create/send/track · convert to SO · SO management · stock
reservation · shipment (pick/pack/ship, partial) → stock relief · invoicing
handoff · portal estimate accept · lists/export · permissions · audit.
*(Live: `src/lib/services/{estimates,sales-orders}.ts`,
`/dashboard/{estimates,sales-orders}`, `/portal`.)*

## 18. Future / Advanced Scope

Backorders · RMA/returns · price lists & promotions · credit checks · recurring
orders · drop-ship · multi-warehouse fulfilment · kits/bundles · rich portal.

## 19. Interoperability & Integration

Sales drives the **quote-to-cash loop**, consuming Inventory and feeding
Invoicing; the portal connects external customers in.

**Aggregate types:** `estimate`, `sales_order`, `shipment`, `customer`,
`portal_contact`.

**Events emitted**

| Event | When | Payload |
|-------|------|---------|
| `estimate.sent/viewed/accepted/rejected/expired` | quote lifecycle | estimateId, customerId |
| `estimate.converted` | quote → SO | estimateId, salesOrderId |
| `salesorder.approved/cancelled` | SO lifecycle | soId, customerId |
| `salesorder.invoiced` | invoicing trigger | soId, invoiceId |
| `stock.reserved` / `stock.reservation_released` | reserve/cancel | itemId, qty, soId |
| `shipment.picked/packed/shipped/delivered` | fulfilment | shipmentId, soId |
| `stock.shipped` | on ship | itemId, qty, shipmentId |
| `portal.comment_added` | customer comment | contactId, targetType, targetId |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Inventory | `stock.low` / availability | allocation & backorder decisions |
| Invoicing | `invoice.paid` | mark SO paid/closed; release credit hold |
| Purchasing | `po.received` (drop-ship) | mark drop-ship line fulfilled |
| Approvals | `approval.approved` (target SO) | approve high-value/credit-hold orders |

**Shared entities & links** — `customer` (FK) and `product` (FK). estimate→SO and
SO→shipment via typed links; SO→invoice via `entity_links` (`invoice bills
sales_order`); SO→drop-ship PO via `entity_links`.

**Scope ladder** — sales orders may attach at board/project rung (a customer
job); `link_policies` governs whether linking is required.

**Idempotency** — reservations/relief dedupe on `(soLineId, shipmentLineId)`;
`salesorder.invoiced` keyed on (soId, invoiceId) to avoid double invoicing.

**Portal interop** — portal auth (`portal-auth.ts`) and portal data
(`portal-data.ts`) expose estimates/orders/invoices to external contacts;
`portal.comment_added` flows into the same activity feed as internal events.
