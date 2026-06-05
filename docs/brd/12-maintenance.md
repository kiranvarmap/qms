# BRD: Maintenance Module (Assets · Work Orders)

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).
> **Status: Planned.** Events marked *(proposed)* are not yet in the catalogue.

## 1. Module Overview

Maintenance manages the company's **assets/equipment** and the work to keep them
running — preventive schedules, breakdown (corrective) work orders, spare-parts
consumption, and downtime tracking. It interlocks with Production (machine
availability), Inventory (spares), HR (technician labor), and Safety/Quality.

## 2. Business Objectives

- Maintain an accurate asset/equipment register
- Reduce unplanned downtime via preventive maintenance
- Track breakdowns and mean-time metrics (MTBF/MTTR)
- Consume and reorder spare parts correctly
- Capture maintenance cost per asset
- Support safety and compliance (inspections, calibration)

## 3. Target Users

Maintenance managers · technicians · production supervisors · inventory (spares)
· safety/compliance · finance (asset cost) · auditors.

## 4. User Roles

Maintenance Admin · Planner · Technician · Production Supervisor · Inventory ·
Auditor · Viewer.

## 5. Feature Scope

Asset register & hierarchy · meters/usage · preventive maintenance (PM)
schedules · maintenance work orders (corrective/preventive) · spare-parts
consumption · downtime tracking · technician assignment & labor · checklists ·
calibration (advanced) · condition-based maintenance (advanced) · reports · audit.

## 6. Default Features

- **Asset register** — asset code, name, type, location, parent asset, status,
  purchase/warranty info, criticality.
- **PM schedules** — time- or meter-based; checklist; auto-generate WOs.
- **Maintenance work order** — corrective/preventive; fault, priority, assignee,
  status (open → in-progress → on-hold → completed → closed).
- **Spare-parts consumption** — issue parts from inventory to the WO.
- **Labor logging** — technician time per WO.
- **Downtime capture** — start/end, reason.
- **Lists & search** — assets, WOs by status/asset/date; export.

## 7. Advanced Features

- **Condition-based / predictive maintenance** (sensor/IoT thresholds).
- **MTBF / MTTR / availability analytics**.
- **Calibration management** (links to Quality gauges).
- **Maintenance budgets & cost rollup per asset**.
- **Failure codes & root-cause** analytics.
- **Mobile technician app** (scan asset, complete checklist).
- **Spare-parts min/max & auto-reorder**.
- **Warranty & AMC/contract tracking**.

## 8. Key Workflows

**Preventive** → PM schedule due → auto-generate maintenance WO
(`maintenance.scheduled` *(proposed)*) → assign technician → execute checklist →
consume spares (`stock.adjusted`) → log labor (`timelog.*`) → close
(`maintenance.completed` *(proposed)*).

**Breakdown** → fault reported → WO raised (`maintenance.started` *(proposed)*) →
asset marked down (interlocks Production) → repair → spares/labor → asset back up
→ close.

**Spare reorder** → spare `stock.low` → purchase loop.

## 9. Screens / Pages Required

Asset Register · Asset Detail (history, meters, WOs, cost) · PM Schedules ·
Maintenance WO List · Create/Edit WO · WO Detail (tasks, parts, labor, downtime,
activity) · Technician dashboard · Maintenance Reports · Maintenance Settings.

## 10. Key Data Fields

**Asset** — id, code, name, type, parentAssetId, location, status (up/down/
maintenance), criticality, purchase date, warranty, meters, `workspaceId`.

**PM schedule** — id, assetId, basis (time/meter), interval, checklist, next due.

**Maintenance WO** — id, number, assetId, type (corrective/preventive), priority,
fault, status, assigneeId, scheduled/closed dates.

**WO part** — id, woId, itemId(spare), qty used.

**Downtime** — id, assetId, woId, start, end, reason.

## 11. Business Rules

- Every maintenance WO references an asset.
- Preventive WOs auto-generate from schedules; not duplicated for the same due
  cycle (idempotent).
- Spare consumption reduces inventory atomically with `stock.adjusted`.
- Asset marked "down" signals Production to pause dependent work orders.
- Calibration-failed gauges block dependent inspections (advanced).
- WO cannot close with open mandatory checklist items.

## 12. Permissions

view maintenance · manage assets · manage PM schedules · create/assign WO ·
execute WO · consume spares · log labor · close WO · manage settings · export.

## 13. Notifications & Alerts

PM due/overdue · breakdown reported · WO assigned · asset down · spare shortage ·
calibration due · warranty expiring · WO overdue.

## 14. Reports & Dashboards

**Widgets:** assets down · PM compliance % · open WOs · overdue WOs · downtime
hours · maintenance cost MTD.

**Reports:** asset history · PM compliance · MTBF/MTTR/availability · downtime
analysis · maintenance cost per asset · spare-parts usage · failure Pareto.

## 15. Configuration Settings

Asset codes & hierarchy · criticality levels · PM templates/intervals · failure
codes · WO numbering · spare min/max · calibration rules · `link_policies` ·
notifications.

## 16. Audit Trail Requirements

Asset changes; PM schedule edits; WO lifecycle; parts/labor; downtime; calibration
records; activity-feed entry per event.

## 17. MVP Scope

Asset register · PM schedules → auto WO · corrective WOs · spare consumption →
inventory · labor logging · downtime capture · asset status · reports ·
permissions · audit.

## 18. Future / Advanced Scope

Condition-based/predictive · MTBF/MTTR analytics · calibration · cost rollup ·
failure RCA · mobile app · spare auto-reorder · warranty/AMC tracking.

## 19. Interoperability & Integration

Maintenance keeps the **assets that Production depends on** healthy, drawing
spares from Inventory and labor from HR.

**Aggregate types (proposed):** `asset`, `maintenance_order`.

**Events emitted (proposed)**

| Event | When | Payload |
|-------|------|---------|
| `asset.created` / `asset.status_changed` | register / up↔down | assetId, status |
| `maintenance.scheduled` | PM WO generated | woId, assetId, dueDate |
| `maintenance.started` | breakdown/repair begins | woId, assetId |
| `maintenance.completed` | WO closed | woId, assetId, downtime |
| `stock.adjusted` | spare consumed | itemId, delta, woId |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Production *(planned)* | machine runtime / `workorder.completed` | advance meter → trigger meter-based PM |
| Inventory | spare `stock.low` | flag/raise spare reorder |
| Safety | `incident.reported` (equipment) | raise corrective maintenance WO |
| Quality | calibration need | schedule gauge calibration |

**Shared entities & links** — references `item` (spares) and `employee`
(technicians). `asset` is referenced by Production WO operations (`machine`),
Quality (gauges/calibration), and Safety (incident equipment) via FK/
`entity_links`. Asset "down" status is the interlock signal to Production.

**Scope ladder** — assets are workspace/site-scoped; maintenance WOs attach at
the board/job rung; labor at the item rung (labor loop reuse).

**Idempotency** — PM WO generation deduped on (assetId, scheduleId, dueCycle);
spare consumption on (woId, lineId).
