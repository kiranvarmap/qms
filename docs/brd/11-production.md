# BRD: Production / Manufacturing Module

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).
> **Status: Planned.** Events marked *(proposed)* are not yet in
> `src/lib/events/types.ts`; this BRD defines the contract to add.

## 1. Module Overview

Production turns demand (sales orders or forecasts) into manufactured output:
defining what to make (BOM/routing), issuing work orders, consuming raw
materials, recording operations and labor, and receiving finished goods — all
wired to Inventory, Quality, HR/labor, and Maintenance.

## 2. Business Objectives

- Plan and execute production against demand
- Consume materials and produce finished goods accurately
- Track WIP, yield, scrap, and cost per work order
- Enforce quality at process and final stages
- Capture labor and machine time per job
- Give real-time shop-floor visibility

## 3. Target Users

Production planners · supervisors · machine operators (worker identities) ·
quality · inventory/warehouse · maintenance · costing/finance · management.

## 4. User Roles

Production Admin · Planner/Scheduler · Supervisor · Operator (worker) · Quality ·
Inventory · Maintenance · Costing · Viewer.

## 5. Feature Scope

Bill of Materials (BOM) · routing/operations · work orders · material issue/
backflush · WIP tracking · finished-goods receipt · scrap/rework · labor &
machine time · process & final inspection · capacity/scheduling (advanced) · job
costing · OEE (advanced) · reports · audit.

## 6. Default Features

- **BOM** — components, quantities, UoM per finished product; versioned.
- **Routing** — ordered operations, work centres, standard times.
- **Work order** — make X of product Y by date; status: planned → released →
  in-progress → completed → closed.
- **Material issue** — issue/backflush components from inventory to the WO.
- **Production reporting** — record produced qty, scrap, operation completion.
- **Finished-goods receipt** — receive output into inventory.
- **Lists & search** — work orders by product/status/date; export.

## 7. Advanced Features

- **Finite/infinite scheduling & capacity planning**.
- **MRP** — explode demand → planned orders (POs + WOs).
- **OEE / downtime / machine integration (IoT)**.
- **Lot/serial genealogy** (full forward/backward traceability).
- **Subcontracting** operations (linked PO).
- **By-products / co-products / yield variance**.
- **Job costing & variance analysis** (material/labor/overhead).
- **Andon / shop-floor terminals**.

## 8. Key Workflows

**Plan → make → stock** → create WO (from SO or plan) → release
(`workorder.released` *(proposed)*) → reserve/issue components (`stock.reserved`/
`stock.adjusted`) → operators run operations, log time (`timelog.*`) → record
output + scrap → final inspection (`inspection.submitted`) → on pass, receive FG
(`stock.received`) → close (`workorder.completed` *(proposed)*).

**Quality in-process** → operation completion can trigger an in-process
inspection; failure raises CAPA (quality loop).

**Maintenance interlock** → machine breakdown (`maintenance.*`) pauses affected
WOs.

## 9. Screens / Pages Required

BOM Management · Routing/Work Centres · Work Order List · Create/Edit WO · WO
Detail (materials, operations, labor, output, inspections, activity) · Shop-floor
terminal · Material Issue · FG Receipt · Scheduling board (advanced) · Production
Reports · Production Settings.

## 10. Key Data Fields

**BOM** — id, productId, version, status; **BOM line** — componentItemId, qty,
UoM, scrap %.

**Routing/operation** — id, productId, sequence, work centre, std time.

**Work order** — id, number, productId, qty planned/produced/scrapped, status,
due date, sourceRef (salesOrderId), `workspaceId`.

**WO material** — id, woId, componentItemId, qty required/issued.

**WO operation log** — id, woId, operation, operator(employeeId), machine(assetId),
start/end, qty good/scrap.

## 11. Business Rules

- WO requires an active BOM (and routing if operations tracked).
- Components consumed (issue/backflush) reduce inventory atomically with events.
- Produced + scrapped ≤ planned + tolerance.
- FG receipt only after required inspections pass (when gated).
- Lot/serial genealogy recorded for traceable products.
- WO cannot close with open operations or unissued mandatory materials.

## 12. Permissions

view production · manage BOM/routing · create/release WO · issue materials ·
report production · receive FG · log labor/machine · close WO · manage settings ·
export.

## 13. Notifications & Alerts

WO released/overdue · material shortage for WO · operation complete · scrap
threshold exceeded · inspection failed on WO · machine down affecting WO · FG
received.

## 14. Reports & Dashboards

**Widgets:** open WOs · WIP value · today's output vs plan · scrap rate · on-time
completion · machine utilisation.

**Reports:** production output · WIP/aging · yield & scrap · job cost & variance ·
labor/machine utilisation · OEE · traceability (lot genealogy).

## 15. Configuration Settings

WO numbering · BOM/routing rules · backflush vs manual issue · scrap tolerance ·
quality-gate points · costing method · scheduling parameters · `link_policies` ·
notifications.

## 16. Audit Trail Requirements

BOM/routing versions; WO lifecycle; material issues; operation/labor logs;
output/scrap entries; inspection links; genealogy; activity-feed entry per event.

## 17. MVP Scope

BOM · routing · work orders · material issue/backflush → inventory consume ·
production reporting · FG receipt → inventory · final inspection link · job-level
visibility · reports · permissions · audit.

## 18. Future / Advanced Scope

Scheduling/capacity · MRP · OEE/IoT · lot/serial genealogy · subcontracting ·
by-products · job costing/variance · andon/terminals.

## 19. Interoperability & Integration

Production is the **conversion hub**: it consumes raw inventory + labor and
produces finished inventory, gated by quality.

**Aggregate types (proposed):** `work_order`, `bom`.

**Events emitted (proposed)**

| Event | When | Payload |
|-------|------|---------|
| `workorder.released` | WO released to floor | woId, productId, qty |
| `workorder.completed` | output received | woId, qtyProduced, qtyScrapped |
| `stock.adjusted` / `stock.reserved` | component consume/reserve | itemId, delta, woId |
| `stock.received` | FG receipt | itemId(FG), qty, woId |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Sales | `salesorder.approved` | create make-to-order WO (or MRP demand) |
| Inventory | `stock.low` (component) | flag shortage; trigger purchase/MRP |
| Quality | `inspection.flagged` (in-process/final) | hold WO / scrap / rework |
| HR | `timelog.checked_out` | attribute labor cost to the WO |
| Maintenance | `maintenance.started` (machine down) | pause affected WOs |

**Shared entities & links** — references `item/product` (BOM lines, FG),
`employee` (operators), `asset` (machines, from Maintenance). WO links to
`sales_order` via `entity_links` (`workorder fulfills sales_order`) and to
inspections (`inspection verifies work_order`).

**Scope ladder** — work orders attach at the board/job rung; operations/time logs
at the item rung — feeding the existing labor loop and job-cost roll-ups.

**Idempotency** — component consumption and FG receipt dedupe on (woId, lineId);
`workorder.completed` keyed on woId.

**Reuses** — the same `stock.*` events as Inventory, the labor loop from HR, and
the quality loop from Quality — Production adds orchestration, not new plumbing.
