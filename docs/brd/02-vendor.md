# BRD: Vendor Management Module

> See [00 — Platform Interoperability Foundation](00-platform-interoperability.md).

## 1. Module Overview

Vendor Management is the master-data and relationship hub for everyone the
company buys from — suppliers of raw materials, components, services,
consumables, and subcontracted work. It owns vendor identity, contacts,
commercial terms, compliance documents, and performance, and feeds every
procurement transaction downstream.

## 2. Business Objectives

- Single, de-duplicated vendor master
- Capture commercial terms (payment terms, currency, tax registration, lead time)
- Track compliance (licenses, certifications, insurance, quality approvals)
- Measure vendor performance (on-time, quality, price)
- Enable fast, governed onboarding and approval of new vendors
- Power purchasing, AP, and quality with reliable vendor data

## 3. Target Users

Procurement teams · finance/AP · quality (supplier approval) · plant buyers ·
management · auditors.

## 4. User Roles

Procurement Admin · Buyer · Vendor Approver · Finance/AP User · Quality
(Supplier QA) · Auditor · Viewer.

## 5. Feature Scope

Vendor master · contacts · categories/classifications · commercial terms ·
addresses (billing/shipping/remit-to) · bank/payment details · compliance
documents · approval workflow · status lifecycle · performance scorecard ·
vendor portal (advanced) · audit trail.

## 6. Default Features

- **Vendor master** — create/edit/view; legal name, display name, vendor code,
  type (manufacturer/distributor/service/subcontractor), category, status.
- **Contacts** — multiple contacts with role, email, phone, primary flag.
- **Addresses** — billing, shipping, remit-to.
- **Commercial terms** — currency, payment terms (e.g. Net 30), tax registration
  number + type (resolved by the workspace country pack — e.g. US EIN/W-9,
  EU/UK VAT no., India GSTIN; see [00 §12](00-platform-interoperability.md)),
  default lead time, incoterms.
- **Compliance documents** — upload license/cert/insurance with expiry; the
  required **statutory doc set is country-driven** (e.g. US W-9/W-8, EU VAT cert,
  India GST cert).
- **Status lifecycle** — draft → pending approval → active → on-hold → blocked →
  archived.
- **Basic vendor list & search** — filter by category/status; export.

## 7. Advanced Features

- **Approval workflow** — configurable multi-step vendor onboarding approval.
- **Supplier quality approval** — quality sign-off before a vendor can be used
  for specified item categories (links to Quality).
- **Performance scorecard** — on-time delivery %, quality reject %, price
  variance, responsiveness; periodic rating.
- **Preferred/approved-vendor lists** per item or category.
- **Vendor portal** — vendors view POs, submit invoices/ASNs, update docs.
- **Bank detail verification & change approval** (fraud control).
- **Document expiry monitoring** with auto-hold when a mandatory doc lapses.

## 8. Key Workflows

**Onboard vendor** → create draft → enter terms + compliance docs → submit for
approval (`approval.requested`) → approver reviews → approve → status `active`
→ emits `vendor.created`.

**Block/hold vendor** → set status → new POs prevented → notification to buyers.

**Compliance lapse** → mandatory doc expires → vendor auto-held → procurement +
vendor notified → re-upload → re-activate.

## 9. Screens / Pages Required

Vendor List · Create/Edit Vendor · Vendor Detail (overview, contacts, addresses,
terms, documents, POs, invoices, performance) · Vendor Approval Queue ·
Compliance/Document Tracker · Vendor Settings.

## 10. Key Data Fields

**Vendor** — id, vendor code, legal name, display name, type, category, status,
currency, payment terms, taxRegistrationNumber + taxIdType (country-resolved),
incoterms, default lead time, primary
contact, created by/date, `workspaceId`.

**Contact** — id, vendorId, name, role, email, phone, primary flag.

**Address** — id, vendorId, kind (billing/shipping/remit), lines, city, state,
country, postcode.

**Compliance doc** — id, vendorId, doc type, number, issued/expiry date, file,
status (valid/expiring/expired).

**Bank detail** — id, vendorId, account name/number, bank, branch, IFIsC/SWIFT,
verified flag.

## 11. Business Rules

- Vendor code unique per workspace (via document-sequence or manual).
- A vendor must be `active` to be selected on a new PO.
- Mandatory compliance docs must be valid for `active` status (else auto-hold).
- Bank-detail changes require re-verification/approval (advanced).
- Blocked/archived vendors are hidden from new transactions but retained for history.
- Quality-restricted item categories require supplier QA approval (advanced).

## 12. Permissions

view vendor · create/edit vendor · approve vendor · manage compliance · manage
bank details · view performance · export · manage settings.

## 13. Notifications & Alerts

Vendor submitted for approval · approved/rejected · document expiring/expired ·
vendor placed on hold/blocked · bank-detail change requested · performance below
threshold.

## 14. Reports & Dashboards

**Widgets:** active vendors · pending approvals · docs expiring soon · top
vendors by spend · vendors on hold.

**Reports:** vendor master list · spend by vendor · compliance status · vendor
performance scorecard · approval audit.

## 15. Configuration Settings

Vendor code numbering · categories/types · required compliance doc types ·
approval workflow steps · performance KPI weights · default terms · custom
fields · `link_policies`.

## 16. Audit Trail Requirements

Creation/edit field-level history; approval decisions + approver/time;
status-change history; document upload/expiry events; bank-detail change history;
activity-feed entry per event.

## 17. MVP Scope

Vendor master · contacts · addresses · commercial terms · compliance docs ·
status lifecycle · basic approval · list/search/export · permissions · audit.
*(Live: `/dashboard/vendors`, used by `purchasing.ts`.)*

## 18. Future / Advanced Scope

Multi-step approval · supplier quality approval · performance scorecard ·
preferred-vendor lists · vendor portal · bank verification · auto-hold on doc
lapse · spend analytics.

## 19. Interoperability & Integration

Vendor is **upstream master data** for the procure-to-pay loop.

**Aggregate type:** `vendor`.

**Events emitted**

| Event | When | Payload |
|-------|------|---------|
| `vendor.created` | vendor approved/activated | vendorId, code, category |
| `approval.requested` | onboarding submitted | aggregate `vendor`, vendorId |
| `certification.expiring` *(reuse)* | mandatory doc nearing expiry | vendorId, docType, expiry |

**Events consumed**

| From | Event | Reaction |
|------|-------|----------|
| Approvals | `approval.approved/rejected` (target `vendor`) | set status active / rejected |
| Purchasing | `po.received` | update on-time + performance metrics |
| Quality | `inspection.flagged` (incoming) | update quality-reject metric; may auto-hold |
| Invoicing | `invoice.paid` (AP) | update spend/AP history |

**Shared entities & links** — `vendor` is referenced (FK) by Purchase Orders,
Goods Receipts, AP Invoices, and Expenses. Vendor ↔ approved item categories via
`entity_links`. No module copies vendor master data; all link by `vendorId`.

**Scope ladder** — vendor master is **workspace-scoped** (organization-level
master data), not per-board.

**Idempotency** — `vendor.created` keyed on vendorId; performance roll-ups are
aggregations recomputed from source events, so re-delivery is safe.

**Cross-module dependency** — Purchasing's "select vendor" and Finance's AP both
hard-depend on Vendor; a blocked/expired-doc vendor must surface at PO creation
time (read current status, do not trust cached copies).
