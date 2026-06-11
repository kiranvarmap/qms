# BRD: Safety (EHS) Module

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).
> **Status: Planned.** Events marked *(proposed)* are not yet in the catalogue.

## 1. Module Overview

The Safety / EHS (Environment, Health & Safety) module manages workplace safety:
incident and near-miss reporting, hazard identification, safety inspections/
audits, permits-to-work, PPE, and the corrective actions that close them out. It
reuses the platform's CAPA/quality loop, training competency, and asset/
maintenance links.

## 2. Business Objectives

- Capture incidents, near-misses, and hazards quickly (including by workers)
- Investigate root cause and drive corrective/preventive actions
- Track safety inspections, audits, and compliance
- Manage permits-to-work and PPE
- Ensure required safety training/competency
- Report regulatory safety metrics (TRIR, LTIFR, etc.)

## 3. Target Users

EHS managers · safety officers · supervisors · employees/workers (reporters) ·
HR · maintenance · auditors/regulators · management.

## 4. User Roles

Safety Admin · EHS Officer · Investigator · Supervisor · Employee/Worker
(reporter) · Auditor · Viewer.

## 5. Feature Scope

Incident reporting · near-miss & hazard reporting · investigation & root cause ·
corrective/preventive actions (CAPA reuse) · safety inspections/audits ·
permit-to-work (advanced) · PPE management (advanced) · safety training links ·
risk assessments (advanced) · regulatory reporting · reports · audit.

## 6. Default Features

- **Incident report** — type (injury/property/environmental/near-miss), date,
  location, people involved, description, severity, photos.
- **Hazard / near-miss report** — quick capture (mobile/worker-friendly).
- **Investigation** — assign investigator, root cause, contributing factors.
- **Corrective actions** — create action(s) → tracked task (CAPA reuse).
- **Safety inspections** — checklist-based (reuse inspection templates).
- **Status** — reported → under investigation → actions open → closed.
- **Lists & search** — incidents/hazards by type/status/location/date; export.

## 7. Advanced Features

- **Permit-to-work** (hot work, confined space) with approvals.
- **PPE management** (issue/track, expiry).
- **Risk assessments / JSA** (job safety analysis) with risk matrix.
- **Regulatory report generators** (OSHA/local: TRIR, LTIFR, DART).
- **Safety observations / BBS** (behaviour-based safety).
- **Emergency drills & action tracking**.
- **Contractor safety management**.
- **Environmental monitoring** (emissions/waste).

## 8. Key Workflows

**Incident → CAPA** → report incident (`incident.reported` *(proposed)*) → assign
investigation (`incident.investigation_started` *(proposed)*) → root cause →
create corrective actions (reuses the **CAPA board-task** mechanism) → actions
completed → close (`incident.closed` *(proposed)*).

**Hazard/near-miss** → quick report → triage → action or accept risk.

**Safety inspection/audit** → run checklist (reuse Quality inspections) →
findings → CAPA.

**Permit-to-work (advanced)** → request permit → `approval.requested` → approve →
work proceeds under controls → close permit.

## 9. Screens / Pages Required

Incident List · Report Incident (+ mobile quick form) · Incident Detail
(investigation, actions, links, activity) · Hazard/Near-miss board · Safety
Inspections · Permits (advanced) · PPE (advanced) · Risk Assessments (advanced) ·
Safety Reports · Safety Settings.

## 10. Key Data Fields

**Incident** — id, number, type, severity, date/time, location, assetId?,
reportedBy, peopleInvolved[], description, status, investigatorId, root cause,
`workspaceId`.

**Action (CAPA)** — id, incidentId, description, assignee, due date, status,
boardId (reuses corrective-action tasks).

**Permit** — id, type, requester, controls, approver, validity, status.

**PPE record** — id, employeeId, item, issued/expiry date.

## 11. Business Rules

- Any worker/employee can report an incident/near-miss (low-friction).
- Severity drives mandatory investigation & timelines.
- Corrective actions required to close a non-trivial incident.
- Recordable incidents feed regulatory metrics.
- Permit-to-work requires approval before work starts (advanced).
- Safety-training non-compliance can block hazardous task assignment (links to
  Training).

## 12. Permissions

report incident/hazard · view incidents · investigate · manage actions · run
safety inspections · approve permits · manage PPE · regulatory reporting · manage
settings · export.

## 13. Notifications & Alerts

Incident reported (to EHS + management for high severity) · investigation
assigned/overdue · corrective action assigned/overdue · permit requested/approved
· PPE expiring · safety training overdue · audit finding.

## 14. Reports & Dashboards

**Widgets:** open incidents · days since last incident · open safety actions ·
overdue actions · near-miss count · TRIR/LTIFR trend.

**Reports:** incident register · incident by type/location/severity · TRIR/LTIFR/
DART · corrective-action status · safety-inspection compliance · near-miss trend ·
training compliance · regulatory exports.

## 15. Configuration Settings

Incident types & severity · investigation timelines · action workflow (CAPA
reuse) · permit types & controls · PPE catalog · risk matrix · regulatory report
templates · `link_policies` · notifications.

## 16. Audit Trail Requirements

Incident lifecycle; investigation findings; action lifecycle; permit approvals;
PPE issuance; report submissions; activity-feed entry per event. Records
immutable after closure/sign-off.

## 17. MVP Scope

Incident/near-miss/hazard reporting · investigation & root cause · corrective
actions (CAPA reuse) · safety inspections (inspection reuse) · statuses · basic
safety reports · permissions · audit.

## 18. Future / Advanced Scope

Permit-to-work · PPE management · risk assessment/JSA · regulatory generators ·
BBS observations · drills · contractor safety · environmental monitoring.

## 19. Interoperability & Integration

Safety **reuses existing loops** (CAPA, inspections, approvals, training) rather
than inventing new ones — the clearest proof of the platform's interoperability.

**Aggregate types (proposed):** `incident`, plus reuse of corrective-action tasks
and `inspection` for safety audits.

**Events emitted (proposed)**

| Event | When | Payload |
|-------|------|---------|
| `incident.reported` | incident/near-miss logged | incidentId, type, severity, location |
| `incident.investigation_started` | investigation assigned | incidentId, investigatorId |
| `incident.closed` | actions complete | incidentId |
| `approval.requested` (reuse) | permit-to-work | aggregate `permit` |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Maintenance | `asset.status_changed` (equipment fault) | correlate to incident; raise maintenance WO |
| Quality | safety-inspection `inspection.flagged` | open safety CAPA |
| Training | `certification.expiring` (safety cert) | block hazardous task; prompt re-training |
| Approvals | `approval.approved` (permit) | activate permit-to-work |

**Shared mechanisms reused** — corrective actions use the **same board-task CAPA
consumer** as Quality (`inspection.flagged` → task); safety audits use **Quality
inspection templates**; permits use the **generic Approvals** service; competency
uses **Training** certifications; equipment incidents link to **Maintenance**
assets.

**Shared entities & links** — references `employee` (reporter/involved/
investigator), `asset` (equipment involved). Incident ↔ corrective-action tasks,
incident ↔ asset, incident ↔ inspection via `entity_links`.

**Scope ladder** — incidents attach at workspace/site or the board/job rung
(where it happened); actions at the item/task rung.

**Idempotency** — `incident.reported` keyed on incidentId; CAPA task creation
"create if not exists" on (incidentId, actionId) — identical to the quality loop.
