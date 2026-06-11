# BRD: Quality Module (Inspections · NCR · CAPA)

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

The Quality module runs inspections across the lifecycle (incoming, in-process,
final), captures non-conformances (NCR), and drives corrective/preventive actions
(CAPA) — automatically turning a flagged inspection into a tracked board task. It
is deeply wired into the platform's quality loop and links inspections to the
items, lots, vendors, and jobs they concern.

## 2. Business Objectives

- Standardize inspections via templates/checklists
- Catch non-conformances early and act on them
- Close the loop from defect → corrective action → verification
- Trace quality to item/lot/vendor/job
- Provide e-signed, audit-ready quality records
- Drive supplier quality and continuous improvement

## 3. Target Users

Quality inspectors · QA/QC managers · production supervisors · suppliers (via
quality) · auditors · management.

## 4. User Roles

Quality Admin · Inspector · QA Manager · Reviewer/Approver · Production
Supervisor · Auditor · Viewer.

## 5. Feature Scope

Inspection templates/checklists · inspection execution (incoming/in-process/
final) · pass/fail/measurements · attachments/photos · e-signature · NCR ·
CAPA (corrective/preventive actions) · disposition (accept/reject/rework/
quarantine/scrap) · supplier quality · SPC (advanced) · audits (advanced) ·
reports · audit trail.

## 6. Default Features

- **Inspection templates** — checklist items, measurement specs, accept criteria.
- **Run inspection** — against an item/lot/job; record results, measurements,
  photos; pass/fail.
- **Submit & sign** — submit inspection; e-signature (`signdoc`/sign module).
- **Flag non-conformance** — failing inspection raises a flag → auto-creates a
  "Corrective Actions" board task (CAPA) wired to the item.
- **NCR** — raise a non-conformance report with severity, description, evidence.
- **Disposition** — accept / reject / rework / quarantine / scrap.
- **Remediation** — track action to completion; mark inspection remediated.
- **Lists & search** — inspections/NCRs by item/status/date; export.

## 7. Advanced Features

- **Sampling plans (AQL)** & skip-lot.
- **SPC / control charts** on measurements.
- **8D / root-cause (5-Why, fishbone)** structured CAPA.
- **Supplier quality** — incoming-inspection-driven vendor scorecard; supplier
  CAPA.
- **Audit management** (internal/external, findings → CAPA).
- **Calibration management** for gauges/instruments.
- **Quality gates** — block stock/shipment until inspection passes.
- **Competency-gated inspectors** (require certification from Training).

## 8. Key Workflows

**Inspection → CAPA (the quality loop)** → run inspection → submit
(`inspection.submitted`) → if fail, `inspection.flagged` → **consumer creates a
Corrective Actions board task**, wires `inspection_actions.itemId`, and links
inspection `remediates` item (`entity_links`) → action worked → close →
`inspection.remediated`.

**NCR** → `ncr.raised` → disposition decided → linked action(s) tracked → closure.

**Sign-off** → reviewer e-signs → `inspection.signed`.

**Quality gate (advanced)** → received lot must pass incoming inspection before
`stock.received` is available for use; failing → quarantine.

## 9. Screens / Pages Required

Inspection List · Inspection Templates · Run/Edit Inspection · Inspection Detail
(results, signatures, actions, links, activity) · NCR List/Detail · CAPA board
(corrective actions) · Disposition · Supplier Quality · PDF templates · Quality
Reports · Quality Settings.

## 10. Key Data Fields

**Inspection** — id, templateId, type (incoming/in-process/final), itemId, lot/
serial, vendorId (incoming), result, status, inspectorId, signed-by, boardId/
groupId/itemId/linkLevel (scope), `workspaceId`.

**Inspection result line** — id, inspectionId, check item, spec, measured value,
pass/fail, note, attachment.

**Inspection action (CAPA)** — id, inspectionId, type (corrective/preventive),
description, assignee, due date, status, boardId, itemId, `workspaceId`.

**NCR** — id, inspectionId/itemId, severity, description, disposition, status,
raised-by.

## 11. Business Rules

- An inspection references the item/lot/job it concerns (scope ancestry recorded).
- A failed inspection must raise a flag/NCR (config) → CAPA created.
- Disposition required before closing a non-conforming inspection.
- Inspection cannot be `signed` until completed.
- Quality-gated stock is not "available" until inspection passes (advanced).
- Only certified inspectors may run gated inspections (advanced).
- Records are immutable after sign-off (corrections via new revision).

## 12. Permissions

view quality · create templates · run inspection · sign/approve · raise NCR ·
manage CAPA · set disposition · manage supplier quality · export · manage
settings.

## 13. Notifications & Alerts

Inspection assigned/submitted · inspection flagged/failed · NCR raised · CAPA
assigned/overdue · disposition needed · sign-off requested · supplier quality
issue · calibration due (advanced).

## 14. Reports & Dashboards

**Widgets:** open inspections · failures/NCRs (rate) · open CAPAs · overdue CAPAs
· first-pass yield · supplier reject rate.

**Reports:** inspection log · NCR register · CAPA status & cycle-time · defect
Pareto · first-pass yield/trend · supplier quality scorecard · audit findings ·
traceability (item/lot → inspections).

## 15. Configuration Settings

Inspection templates & specs · inspection types · disposition codes · CAPA
workflow & due-date rules · quality gates · sampling plans · e-signature settings
· supplier-quality rules · `link_policies` (scope rung for inspections) ·
notifications.

## 16. Audit Trail Requirements

Inspection results & revisions; e-signatures (who/when); flags/NCRs; CAPA
lifecycle; disposition decisions; links to item/lot/vendor; activity-feed entry
per event. Signed records immutable.

## 17. MVP Scope

Templates · run inspection (incoming/in-process/final) · results/measurements/
photos · submit & e-sign · flag → auto CAPA board task (wired to item) · NCR ·
disposition · remediation/closure · reports · permissions · audit.
*(Live: quality loop in `src/lib/events/consumers.ts`, `inspection_actions`,
`/dashboard/inspections`, sign module.)*

## 18. Future / Advanced Scope

AQL sampling/skip-lot · SPC · 8D/RCA · supplier CAPA & scorecard · audit
management · calibration · quality gates on stock/shipment · competency-gated
inspectors.

## 19. Interoperability & Integration

Quality is the platform's **flagship interoperability example** — the inspection
→ CAPA loop already crosses Quality, Boards/Tasks, Inventory, and People.

**Aggregate types:** `inspection`, `sign_document` (and CAPA tasks as board
items).

**Events emitted**

| Event | When | Payload |
|-------|------|---------|
| `inspection.submitted` | inspection submitted | inspectionId, itemId, result |
| `inspection.flagged` | failure detected | inspectionId, itemId, severity |
| `ncr.raised` | NCR created | ncrId, inspectionId, itemId |
| `inspection.signed` | e-signed | inspectionId, signerId |
| `inspection.remediated` | CAPA closed | inspectionId, actionId |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Purchasing | `po.received` / `stock.received` | trigger incoming inspection (gate) |
| Production *(planned)* | `workorder.completed` | trigger final inspection |
| Forms | `form.submitted` | intake → create item + (optional) inspection |
| Sign | `signdoc.completed` | mark inspection signed |
| Training | `certification.expiring` | inspector competency check |

**Built-in consumer (already implemented)** — `inspection.flagged` →
- creates a **Corrective Actions board task** (CAPA),
- sets `inspection_actions.itemId/boardId/workspaceId`,
- writes an `entity_links` row: inspection **remediates** item.

**Shared entities & links** — inspections carry scope ancestry (`boardId,
groupId, itemId, linkLevel`) so they roll up to the job/board; link to `item`/
lot, `vendor` (incoming), and the CAPA board task. Quality gates can hold
Inventory (`quarantine`) and block Sales `shipment`.

**Scope ladder** — inspections attach across the full ladder
(`none→workspace→board→group→item`) governed by `link_policies`; this is the
original module the scope-governance mechanism was built for.

**Idempotency** — the flagged→CAPA consumer is "create if not exists" on
(inspectionId) so re-delivery never creates duplicate corrective-action tasks.
