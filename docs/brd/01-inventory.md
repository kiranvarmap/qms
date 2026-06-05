# BRD: Inventory Management Module

> Platform primitives referenced here are defined in
> [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

The Inventory Management module helps manufacturing companies manage stock across
warehouses, plants, storage areas, and bins. It supports simple inventory
tracking for small companies while offering advanced controls for lot/serial
tracking, expiry management, valuation, approvals, and detailed warehouse
operations. Simple by default; advanced capabilities enabled only when required.

## 2. Business Objectives

- Maintain accurate stock visibility
- Reduce stock shortages and overstocking
- Track raw materials, finished goods, spare parts, tools, consumables, packaging
- Improve warehouse and plant-level stock control
- Support stock movement, adjustment, counting, and valuation
- Provide inventory reports for operations and management
- Start with basic inventory and scale into advanced controls

## 3. Target Users

Small/mid/large/multi-site manufacturers; warehouse teams; plant operations;
inventory controllers; finance and audit teams.

## 4. User Roles

Inventory Admin · Warehouse Manager · Warehouse Operator · Inventory Controller ·
Plant Supervisor · Finance User · Auditor · Viewer (read-only).

## 5. Feature Scope

Item master · categories/classifications · warehouse & location management ·
stock tracking · stock in/out · transfer · adjustment · opening stock · reorder
levels · low-stock alerts · barcode/QR · cycle counting · physical inventory ·
damaged/scrap stock · lot/batch/serial tracking · expiry tracking · valuation ·
reports & dashboards · role-based permissions · audit trail.

## 6. Default Features

**Item Master** — create/edit/view, activate/deactivate; SKU, name, description,
category, UoM, opening stock, current stock, reorder level, basic cost, default
warehouse, image, status.

**Inventory Categories** — create/edit, assign items, category-wise stock view.

**Warehouse Management** — create/edit; name, code, address, contact, active flag.

**Basic Location / Bin** — storage location, bin name/code, assign item stock to
bin, view stock by location.

**Stock Tracking** — on hand, available, by warehouse/item/category, movement
history.

**Stock In** — manual add: item, warehouse, qty, date, notes, attachment.

**Stock Out** — manual remove: item, warehouse, qty, reason, notes, attachment.

**Stock Transfer** — between warehouses/locations: source, destination, qty,
status.

**Stock Adjustment** — increase/decrease with reason code, notes, attachment,
history.

**Low Stock Alert** — reorder level per item, alert below threshold, dashboard,
report.

**Basic Barcode / QR** — code per item, print labels, search/scan for basic ops.

**Cycle Count** — create count, select warehouse/items, enter counted qty,
compare vs system, record variance, adjust after review.

**Damaged Stock** — mark damaged, record qty/reason/notes/photos, report.

## 7. Advanced Features

Gated behind **Advanced Settings / configuration**.

- **Advanced warehouse structure** — plant → warehouse → zone → aisle → rack →
  shelf → bin; capacity; blocked locations; preferred location per item.
- **Lot / batch tracking** — per item; lot/batch/supplier-lot numbers, mfg/recv
  dates, lot status, movement history.
- **Serial tracking** — per item; capture at receipt, track through
  transfer/issue; serial lifecycle history.
- **Expiry tracking** — expiry by item/lot, shelf-life config, near-expiry
  alerts, expired-stock blocking, FEFO issuing, expired report.
- **Reservations** — reserve/release; show reserved qty; prevent unauthorized use.
- **Quarantine** — hold/release/reject; reason; history.
- **Scrap** — move to scrap; reason/qty/value; disposal status; report.
- **Advanced cycle counting** — ABC-based, blind count, recount workflow,
  variance approval, frequency, accuracy report.
- **Valuation** — FIFO / weighted average / standard cost; value by
  item/warehouse; cost adjustment; aging value.
- **Advanced barcode workflows** — scan for receive/putaway/pick/transfer/count;
  mobile scanner support.

## 8. Key Workflows

**Create item** → open Item Master → enter details → (optionally expand Advanced)
→ save → code allocated → available for transactions.

**Add stock** → Stock In → item → warehouse/location → qty → reason/notes →
balance updated → history recorded → emits `stock.received`/`item.moved`.

**Issue stock** → Stock Out → item → warehouse → qty → availability check →
confirm → balance reduced → emits `stock.shipped`/`stock.adjusted`.

**Transfer stock** → create transfer → source/destination → items+qty → stock
moved → history recorded → emits `item.moved`.

**Cycle count** → create session → select warehouse/items → enter counts → system
compares → variance shown → adjustment after approval → emits `stock.adjusted`.

## 9. Screens / Pages Required

Inventory Dashboard · Item Master List · Create/Edit Item · Item Detail ·
Category Management · Warehouse Management · Location/Bin Management · Stock On
Hand · Stock Movement History · Stock In · Stock Out · Stock Transfer · Stock
Adjustment · Cycle Count · Damaged Stock · Low Stock Report · Inventory Reports ·
Inventory Settings.

**Advanced:** Lot/Batch · Serial · Expiry · Quarantine · Scrap · Valuation ·
Warehouse Layout.

## 10. Key Data Fields

**Item** — id, SKU, name, description, category, subcategory, type, UoM,
barcode/QR, image, default warehouse, reorder level, min/max stock, standard
cost, current cost, status, created by/date, updated date, `workspaceId`,
`archivedAt`.

**Stock (by location)** — item, warehouse, location/bin, qty on hand, available,
reserved, damaged, quarantine, UoM.

**Transaction** — id, type, item, qty, source location, destination location,
reason code, notes, attachment, created by/date.

## 11. Business Rules

- Stock cannot go below zero unless negative stock is enabled.
- Item code unique; barcode unique if enabled.
- Inactive/archived items cannot be used in new transactions.
- Adjustment requires a reason code.
- Low-stock alert triggers when available < reorder level (emits `stock.low`).
- Expired stock blocked if expiry control enabled.
- Serial-tracked items need a serial per unit; lot-tracked need lot per txn.
- Users transact only in warehouses they may access.
- Valuation updates per selected costing method.

## 12. Permissions

view inventory · create/edit/deactivate item · add/issue/transfer/adjust stock ·
approve adjustment · manage warehouses · manage categories · view valuation ·
export reports · manage settings. (Enforced via `access.ts`, workspace-scoped.)

## 13. Notifications & Alerts

Low stock · out of stock · overstock · adjustment-approval · cycle-count due ·
variance · near-expiry · expired · quarantine-release. (Fan-out via the
notification consumer + `notification_preferences`.)

## 14. Reports & Dashboards

**Widgets:** total inventory value · low-stock · out-of-stock · recent movements
· damaged stock · inventory by category · by warehouse.

**Reports:** stock on hand · by warehouse · movement · low stock · out of stock ·
valuation · aging · cycle-count variance · damaged · scrap · lot traceability ·
serial · expiry.

## 15. Configuration Settings

Item-code numbering (via document-sequence) · categories · UoM · warehouses ·
locations/bins · reason codes · reorder rules · negative-stock rule · barcode
format · approval rules · valuation method · lot/serial/expiry settings ·
notification settings · custom fields · `link_policies` for the module.

## 16. Audit Trail Requirements

Who created/edited an item; field-level old→new; stock movement history;
adjustment history; approval history; archived records; date/time/user; and the
unified activity feed entry per event.

## 17. MVP Scope

Item master · categories · warehouses · basic bin/location · stock on hand · in ·
out · transfer · adjustment · reorder level · low-stock alert · basic barcode/QR
· cycle count · damaged stock · basic reports · role permissions · audit trail.
*(Live in code: `src/lib/services/inventory.ts`, `/dashboard/inventory`.)*

## 18. Future / Advanced Scope

Multi-plant hierarchy · zone/aisle/rack/shelf/bin · lot/batch/serial · expiry ·
FEFO/FIFO issue · quarantine · scrap · reservations · advanced barcode/mobile ·
advanced cycle count · ABC · valuation methods · advanced dashboards · custom
fields · advanced approvals.

## 19. Interoperability & Integration

Inventory is the **stock ledger of record** that procurement, sales, production,
and quality all move quantity through.

**Aggregate types:** `item` (stock-keeping), `product` (catalog), `goods_receipt`.

**Events emitted**

| Event | When | Key payload |
|-------|------|-------------|
| `item.created` / `item.updated` | item master change | itemId, sku, workspaceId |
| `item.status_changed` | activate/deactivate/archive | itemId, from, to |
| `item.moved` | transfer between locations | itemId, fromLoc, toLoc, qty |
| `stock.received` | goods receipt / stock-in | itemId, qty, sourceRef (poId/grnId) |
| `stock.reserved` / `stock.reservation_released` | SO allocation / cancel | itemId, qty, salesOrderId |
| `stock.shipped` | shipment / stock-out | itemId, qty, shipmentId |
| `stock.adjusted` | adjustment / cycle-count variance | itemId, delta, reason |
| `stock.low` | available < reorder level | itemId, available, reorderLevel |

**Events consumed**

| From | Event | Inventory reaction |
|------|-------|--------------------|
| Purchasing | `po.received` / `goods_receipt` | raise on-hand (`stock.received`), update cost (valuation) |
| Sales | `salesorder.approved` | reserve stock (`stock.reserved`) |
| Sales | `shipment.shipped` | relieve stock (`stock.shipped`) |
| Sales | `salesorder.cancelled` | release reservations |
| Quality | `inspection.flagged` (on a received lot) | move lot to quarantine |
| Production *(planned)* | `workorder.completed` | consume components, receive finished goods |

**Shared entities & links** — `product`/`item` is referenced (never copied) by PO
lines, SO/estimate lines, shipment lines, BOMs, and inspections. Inspections link
to the inspected lot via `entity_links` (`inspection remediates item`).

**Scope ladder** — stock records attach at the `item` rung; warehouse/plant map
onto workspace/board scope for roll-ups and permissions.

**Idempotency** — stock mutations dedupe on `(sourceType, sourceId, lineId)` so a
re-delivered `po.received`/`shipment.shipped` does not double-count. `stock.low`
is edge-triggered (emitted once on crossing the threshold).

**Downstream consumers** — Finance reads `stock.received` for AP accrual and
valuation; Reports/activity feed timeline every movement; Notifications fan
`stock.low`/expiry alerts.
