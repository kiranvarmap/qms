# 04 — Module Relationship Map

The explicit catalogue of cross-module loops. Each loop is specified the same
way: **trigger event → consumer → effect → feed/notification**. Consumers live
in `src/lib/events/consumers.ts`, are idempotent (check-before-apply), and run
via the outbox dispatcher.

Legend: ✅ implemented · ⚠️ partial · 🔨 to build (Phase 1 unless noted).

## 1. Inventory ↔ Purchasing

| Loop | Trigger | Consumer → effect | Status |
|---|---|---|---|
| Goods receipt posts stock | `po.received` | `runStockLedger`: GRN lines → `receipt` movements, raise `onHand` | ✅ |
| Receiving QC | `po.received` (product flagged QC-required) | `runReceivingQC` 🔨: spawn inspection from template, link `evidence_for` GRN; failed QC holds the received qty (movement to quarantine location) | ⚠️ hook exists, loop unwired |
| Low stock → replenishment | `stock.low` (emit when projected `available` < reorder level after any movement) | `runReplenishment` 🔨: auto-create draft purchase requisition (one open draft per product, idempotent), notify procurement | 🔨 |
| Purchase return → stock | `purchasereturn.posted` | reverse movement, restore vendor balance | 🔨 |
| Landed cost → valuation | `po.received` + landed-cost rows | valuation layer adjustment | ⚠️ tables exist |

## 2. Purchasing ↔ Vendors

| Loop | Trigger | Consumer → effect | Status |
|---|---|---|---|
| PO lifecycle on vendor 360° | `po.*` events | activity feed rows keyed to vendor aggregate | ✅ |
| Vendor approval | `approval.approved` (subject vendor) | `runApprovalSubjectSync` activates vendor | ✅ |
| Vendor performance scoring | `po.received` (on-time/late, qty match), `inspection.completed` on GRN (quality), `purchasereturn.posted` | `runVendorScoring` 🔨: upsert `vendor_performance` (OTD %, quality ppm, return rate); surfaces on vendor page + PO vendor picker | 🔨 table exists, no writer |
| Vendor bill from PO | `po.received` | draft AP bill pre-filled from received lines | 🔨 |

## 3. Projects ↔ Timesheets ↔ Employees

| Loop | Trigger | Consumer → effect | Status |
|---|---|---|---|
| Clock-out rolls labor to task | `timelog.checked_out` | `runLaborRollup`: attach hours/cost to scoped item; board labor report | ✅ (roll-up via feed; hour aggregation ⚠️) |
| Billable time → invoice | invoice builder pulls `timeLogs` by board/item | line items `billed_by` link 🔨 (FK source exists) | ✅ pull / 🔨 link |
| Leave ↔ capacity | `leave.approved` | `runCapacityImpact` 🔨: mark employee unavailable in `employeeShifts` window → planning engine sees reduced manpower; warn affected `jobStageAssignments` | 🔨 |
| Skills gate assignment | stage requires `stageSkills`; assignment checks `employeeSkills` | planning engine ✅; same check for board-task assignment 🔨 |

## 4. Production planning ↔ Inventory ↔ Capacity

| Loop | Trigger | Consumer → effect | Status |
|---|---|---|---|
| WO release reserves materials | `workorder.released` | `runMaterialReservation` 🔨: BOM-explode → `reservation` movements (+`materialReservations` rows planning already models); shortage → `planningConflicts` + notify | ⚠️ planning models it; stock ledger not posted |
| WO completion posts stock | `workorder.completed` 🔨 (route must emit) | `runWorkOrderCompletion` 🔨: consume reserved materials (`consumes` movements), receive finished goods (`produces` movement at BOM cost), release residual reservations | 🔨 — the single biggest missing loop |
| Capacity from masters | shifts/skills/machines per work center | planning engine reads directly (sync read, not event) | ✅ |
| Asset down → replan | `asset.status_changed` 🔨 | `runCapacityImpact` 🔨: down machine → flag conflicting `jobStageSchedules`, create `planningConflicts` | 🔨 |
| SO due date drives plan | `salesorder.approved` with WO link (`fulfills`) | planner suggestion: schedule stages against due date | 🔨 (Phase 2) |

## 5. Maintenance ↔ Assets ↔ Inventory ↔ Production

| Loop | Trigger | Consumer → effect | Status |
|---|---|---|---|
| PM schedule generates orders | cron sweep over `pmSchedules` (due by date/meter) | `runPmGeneration` 🔨: create maintenance order, assign team, notify | 🔨 |
| Parts usage deducts stock | `maintenance.completed` 🔨 (route must emit) | `runMaintenanceParts` 🔨: `maintenanceParts` lines → `consumes` movements | 🔨 |
| Asset status propagates | asset status route emits `asset.status_changed` 🔨 | capacity impact (see §4); maintenance history on asset 360° | 🔨 |
| Incident → maintenance | `incident.reported` with assetId | optional maintenance order, `caused_by` link | 🔨 |

## 6. Safety ↔ Tasks ↔ Employees ↔ Assets ↔ Compliance

| Loop | Trigger | Consumer → effect | Status |
|---|---|---|---|
| Incident → investigation task | `incident.reported` | reuse `runQualityLoop` pattern 🔨: board task on safety board, `remediates` link, assign safety officer | ⚠️ event emits; task loop unwired |
| Safety inspection → CAPA | `inspection.flagged` (safety template) | `runQualityLoop` → corrective task | ✅ (same loop as quality) |
| Cert-gated work | assignment of inspection/board task/stage requiring certification | guard reads `certificationRecords` validity 🔨 | 🔨 |
| Cert expiry → retraining | `certification.expiring` (cron sweep) | notify employee + manager; auto-enroll refresher course | ⚠️ event defined; sweep + enrollment 🔨 |
| Compliance register | all safety/quality events | feed-backed register report per workspace | 🔨 (Phase 5 reporting) |

## 7. Finance spine (orders → documents → approvals → books)

| Loop | Trigger | Consumer → effect | Status |
|---|---|---|---|
| Estimate → SO → shipment → invoice | `estimate.converted`, `salesorder.invoiced`, `shipment.shipped` | conversion + stock lifecycle (single deduction at shipment) | ✅ |
| Approvals route documents | `approval.requested/approved/rejected` | `runApprovalRouting` (notify) + `runApprovalSubjectSync` (PO/vendor/expense/leave state) | ✅ — extend subjects: requisition, WO, maintenance, ECR, credit note 🔨 |
| Operational events → GL posting | `invoice.sent`, `payment.recorded`, `shipment.shipped` (COGS), `po.received`/bill, `expense.reimbursed` | `runGlPosting` 🔨: posting rules (config table: event → debit/credit accounts) → balanced `journalEntries`; trial balance becomes operationally true | 🔨 (Phase 2) |
| Project cost roll-up | PO/expense/invoice/timeLog scoped to board/item | item 360° report aggregates (✅ `/api/reports/item/[itemId]`); margin view (revenue − labor − material − expense) 🔨 |
| Dunning | `invoice.overdue` (cron sweep) | dunning log + reminder notifications | ⚠️ tables exist, sweep 🔨 |

## 8. Products / Engineering change

| Loop | Trigger | Consumer → effect | Status |
|---|---|---|---|
| Master data events | product/customer/asset routes emit `*.created/updated` 🔨 | feed + downstream guards | 🔨 |
| ECR approval → revision | `ecr.approved` (approval engine) | `runEcrPropagation` 🔨: new `productRevisions` row, BOM version bump, flag open POs/WOs/estimates referencing old revision | 🔨 (Phase 2) |
| Product deactivation guard | `product.updated` (status inactive) | warn on open documents referencing it | 🔨 |

## 9. Documents & e-sign (cross-cutting)

| Loop | Trigger | Consumer → effect | Status |
|---|---|---|---|
| Sign completion unblocks | `sign.completed` | linked document advances (vendor contract → vendor active; delivery note → delivered) via `entity_links` | 🔨 |
| Certificates as documents | `certification.issued` | optional signed certificate via DocSign | ⚠️ |

## 10. Phase-1 build list (consumers + emitters, in dependency order)

1. **Emitters first** (small diffs, big unlock): products, customers, assets,
   work orders (complete), maintenance orders, requisitions, AP bills, journal
   entries — every state-changing route calls `emitEvent` in-transaction.
2. `runMaterialReservation` + `runWorkOrderCompletion` (manufacturing↔inventory).
3. `runMaintenanceParts` + `runPmGeneration` + asset status propagation.
4. `runReplenishment` (stock.low → requisition) + `runReceivingQC`.
5. `runVendorScoring`.
6. Safety incident → investigation-task loop (clone of `runQualityLoop`).
7. Cron sweeps: certification expiry, invoice overdue, PM due, approval SLA.
8. `entity_links` written by every converter/fulfiller (estimate→SO, requisition→PO, shipment→SO, WO→SO, task→incident) + `link_policies` enforced at document creation.

`runGlPosting` and `runEcrPropagation` are Phase 2 (need posting-rule config and
revision UX respectively). Each consumer ships with an integration test that
replays its event twice and asserts idempotency ([08 §Phase 1](08-roadmap.md)).
