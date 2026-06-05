# QMS Platform — Business Requirements Documents (BRDs)

This folder holds one BRD per business module of the QMS Integrated Platform.
Each BRD is written so **product, design, engineering, QA, and business** teams
can all use it, and each is explicitly **fitted to interoperability** with the
platform's event-driven core.

## How to read these

Start with the platform substrate, then read any module:

1. **[00 — Platform Interoperability Foundation](00-platform-interoperability.md)** —
   the shared backbone every module plugs into (event outbox, dispatcher,
   `entity_links`, scope ladder + `link_policies`, `activity_feed`, generic
   approvals, document sequences). **Read this first.** Module BRDs reference it
   instead of re-explaining it.

## Modules

| # | Module | Status | Primary events |
|---|--------|--------|----------------|
| 01 | [Inventory Management](01-inventory.md) | MVP live | `item.*`, `stock.*` |
| 02 | [Vendor Management](02-vendor.md) | MVP live | `vendor.created` |
| 03 | [Purchase Management](03-purchasing.md) | MVP live | `po.*`, `stock.received` |
| 04 | [Sales (Estimates · Sales Orders · Shipments)](04-sales.md) | MVP live | `estimate.*`, `salesorder.*`, `shipment.*` |
| 05 | [Invoicing & Books (Accounting)](05-invoicing-books.md) | MVP live | `invoice.*`, `payment.recorded` |
| 06 | [Expense Management](06-expenses.md) | MVP live | `expense.*` |
| 07 | [Approvals (cross-cutting)](07-approvals.md) | MVP live | `approval.*` |
| 08 | [HR, Employees & Leave](08-hr-leave.md) | MVP live | `leave.*` |
| 09 | [Training & Certifications](09-training.md) | MVP live | `course.*`, `certification.*` |
| 10 | [Quality (Inspections · NCR · CAPA)](10-quality.md) | MVP live | `inspection.*`, `ncr.raised` |
| 11 | [Production / Manufacturing](11-production.md) | Planned | `workorder.*` (proposed) |
| 12 | [Maintenance (Assets · Work Orders)](12-maintenance.md) | Planned | `asset.*`, `maintenance.*` (proposed) |
| 13 | [Safety (EHS · Incidents)](13-safety.md) | Planned | `incident.*` (proposed) |

> "Status" reflects whether the module exists in the codebase today. Sections
> labelled **Advanced** or **Proposed** are roadmap scope.

## Mapping to the master BRD

These module BRDs map to the *Integrated Manufacturing Management System* master
BRD as follows:

| Master BRD core module | Covered by |
|------------------------|------------|
| Inventory Management | 01 Inventory |
| Vendor Management | 02 Vendor |
| Purchase Order Management | 03 Purchasing |
| Invoice / Sales Management | 04 Sales + 05 Invoicing & Books |
| Expense Management | 06 Expenses |
| HR Management | 08 HR & Leave |
| QA / Inspection Reports | 10 Quality |
| Workflow / Approval / Notification / Permissions / Audit | 00 Foundation + 07 Approvals |
| **Product Management** | ⏳ *to be added — detailed BRD pending* |
| **Document Signing** | ⏳ *to be added — feature exists in app (`/dashboard/sign`)* |
| **Dashboards & Reports** | ⏳ *to be added (currently per-module §14)* |
| **Platform Core (consolidated)** | ⏳ *to be added (partly in 00 + 07)* |

**Beyond the master BRD**, this set also documents 09 Training, 11 Production,
12 Maintenance, and 13 Safety.

> The four ⏳ items are intentionally deferred pending detailed input.

## Global localization

The platform is **multi-country**: each workspace selects a country/locale, and
tax regimes, party tax identifiers, statutory documents (e.g. US W-9/I-9, EU VAT,
India GST/GSTIN), currency, and formatting adapt automatically. Nothing is
hard-coded to one country. The framework is defined in
**[00 §12 — Localization & country configuration](00-platform-interoperability.md)**;
the Vendor, HR, and Invoicing BRDs reference it rather than naming any single
country's tax form.

## BRD section template

Every module BRD follows this structure:

1. Module Overview
2. Business Objectives
3. Target Users
4. User Roles
5. Feature Scope
6. Default Features
7. Advanced Features
8. Key Workflows
9. Screens / Pages Required
10. Data Fields
11. Business Rules
12. Permissions
13. Notifications & Alerts
14. Reports & Dashboards
15. Configuration Settings
16. Audit Trail Requirements
17. MVP Scope
18. Future / Advanced Scope
19. **Interoperability & Integration** *(events emitted/consumed, shared entities, cross-module flows, scope-ladder behaviour, failure/idempotency)*

## Conventions used across BRDs

- **Event** names use the platform catalogue in `src/lib/events/types.ts`
  (`module.verb`, past tense). Producers emit via the transactional outbox; the
  dispatcher fans out to consumers + the activity feed. See doc 00.
- **Shared entity** = a row other modules link to via `entity_links` or a typed FK.
- **Scope ladder** = `none → workspace → board → group → item`, enforced by
  `link_policies` (see doc 00).
- **Tenancy**: every transactional row carries `workspaceId`.
- **Money**: amounts stored as integer minor units (or numeric) + ISO currency;
  never floats in business logic.
- **MVP vs Advanced**: "Default Features" ship to everyone; "Advanced Features"
  are gated behind module configuration.
