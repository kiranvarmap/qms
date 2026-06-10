# Audit 01 — Supply Chain (Products, Inventory, Purchasing, Vendors)

Cross-cutting gaps P1–P12 ([README §2](README.md)) apply throughout and are not
repeated per module. ✅ verified working · ⚠️ half-baked · ❌ missing.

---

## 1. Products, BOM, Revisions, Specifications, ECR

### Exists today
- Products: full CRUD (list/detail/create/PATCH/DELETE) + detail page with
  Specifications (inline add/delete), BOMs (create+list), Revisions (create+
  release) tabs; lifecycle enum draft/active/obsolete; per-warehouse stock
  rolled into list API. CSV import/export. Gated by `canAccessInventory`.
- BOM: create with lines (qty>0, scrap% 0–100 validated). ECR: create + list
  page + `decide` (approve/reject) with document numbering.

### Half-baked (verified)
- ⚠️ **BOM is write-once** — no line edit/delete, no version lifecycle (status
  enum draft/active/archived exists; everything stays draft).
- ⚠️ **Revisions don't bite**: `products.currentRevision` never auto-set on
  release; nothing references a revision at transaction time (PO/WO lines don't
  pin a revision).
- ⚠️ **ECR approval is a dead end**: approve/reject only — no propagation to a
  new revision, BOM bump, or review of open POs/WOs using the old design.
- ⚠️ Dead flags: `tracksLots`/`tracksSerials` (not enforced at receipt),
  `shelfLifeDays` (no expiry blocking), `barcode` (no routes), BOM `scrapPct`
  (never read by production).
- ⚠️ Product detail doesn't show stock by warehouse (API returns it; UI drops
  it), open POs/SOs/WOs, suppliers (`vendorItems` has no back-reference), or
  movements.

### Missing essentials
- ❌ Category & UoM masters (free-text today → no consistency, no UoM conversion).
- ❌ Soft delete / obsolete-with-guards (hard DELETE today, even with stock/BOM refs).
- ❌ Duplicate product / copy BOM to variant; product images.
- ❌ Where-used (reverse BOM) and multi-level BOM explosion view; BOM cost roll-up.

### Enterprise target model
*Benchmark: Odoo/ERPNext product+BOM, Zoho Inventory item master.*
- **Objects:** product (+ `product_categories` tree, `units_of_measure` +
  conversions, images), BOM versions (draft→active→archived, one active per
  product+revision), revisions auto-stamped onto documents at creation.
- **CRUD:** full + archive/restore + duplicate + import with line items; BOM
  line edit; bulk price/cost update.
- **Screens:** product 360° RecordPanel — Details / Stock (per warehouse +
  lots/serials) / BOM (multi-level, cost roll-up, where-used) / Suppliers
  (vendorItems with last price) / Open documents / Movements / Activity.
- **Rules:** SKU unique per workspace (pre-validated, not just constraint);
  can't obsolete with on-hand stock without warning; lot/serial-tracked items
  must receive with lot/serial; expiry from `shelfLifeDays` drives FEFO picking
  later.
- **ECR loop:** approved ECR → creates next revision draft + BOM copy → flags
  open documents on old revision → release supersedes ([blueprint 04 §8](../04-module-relationship-map.md)).
- **Automation/reporting:** `product.updated` events; slow-mover/dead-stock and
  margin-by-product reports; cert/spec sheet attachments (P9).

---

## 2. Inventory (warehouses, locations, lots, serials, stock, valuation, cycle counts)

### Exists today
- Immutable `stock_movements` ledger + `stock_levels` projection (onHand/
  committed/available) — the right architecture. Warehouses full CRUD.
- Adjustments and transfers (validated: non-zero qty, source≠destination);
  cycle counts with open→counted→posted flow generating variance adjustments;
  FIFO valuation layers + valuation report; stock-status report; lot/serial
  rows created via goods receipt with status enums.

### Half-baked (verified)
- ⚠️ **Locations are decorative**: creatable, but movements never require or
  use them; no edit/delete; no parent-chain validation; `isBlocked` unenforced.
- ⚠️ **Adjustments/transfers vanish**: POST-only, no list/detail screens, no
  reversal — invisible after creation except as raw movements.
- ⚠️ Lots/serials: no independent lifecycle UI (quarantine/scrap transitions
  exist as a status-move API but no screens); serials creatable without lots on
  lot-tracked products; no expiry validation (`expiryDate ≥ mfgDate` unchecked).
- ⚠️ Valuation: FIFO only; `standard`/`average` methods selectable but not
  implemented; no revaluation flow.
- ⚠️ Cycle counts: lines can stay uncounted forever; no variance preview before
  post; no cancel.
- ⚠️ `stock.low` event emitted but consumed by nothing actionable (no
  replenishment doc, no reorder report).

### Missing essentials
- ❌ Reorder automation (min/max per product×warehouse → draft requisition) —
  Odoo "reordering rules", ERPNext "auto material request".
- ❌ Putaway/pick location logic; negative-stock prevention option per warehouse.
- ❌ Stock aging / dead stock / movement-history reports with filters.
- ❌ Transfer-in-transit state (two-step transfer between warehouses/branches).

### Enterprise target model
*Benchmark: Zoho Inventory + Odoo stock.*
- **Documents, not bare posts:** adjustments, transfers, and status-moves become
  listed documents (draft→posted, reversible by reversing doc), each with lines,
  reason codes, attachments, approval option above a threshold.
- **Locations real:** movement lines carry locations when warehouse has them;
  putaway default per product; blocked locations excluded from picking.
- **Lot/serial first-class:** register screens with status transitions
  (available/quarantine/expired/scrapped), traceability view (lot → receipts →
  WOs → shipments — full genealogy), FEFO/expiry alerts via sweep.
- **Replenishment:** reorder rules table + `runReplenishment` consumer
  ([blueprint 04 §1](../04-module-relationship-map.md)) + reorder report screen.
- **Valuation:** implement average cost (most-used), keep FIFO, document
  standard-cost variance handling; period-end valuation report by account.
- **Permissions:** per-warehouse access scoping (storekeeper sees own warehouse).

---

## 3. Purchasing (requisitions, POs, GRN, landed cost, returns)

### Exists today
- The strongest document machine in the app: PO draft→pending_approval→approved
  →sent→partially_received→received→closed/cancelled, all reachable; draft-only
  edit; delete only draft/cancelled; receive validates qty ≤ ordered (with
  epsilon); GRN immutable; receipt posts stock via consumer ✅.
- Requisitions: create/submit/approve/convert-to-PO with `convertedPoId` link.
- Landed costs and purchase returns (draft→posted) exist with screens.
- Approval engine wired for PO submit ✅.

### Half-baked (verified)
- ⚠️ Dead controls: `overReceiptTolerancePct` never enforced; `matchStatus`
  (3-way match) never computed; `poType` blanket/contract changes nothing;
  vendor `onHold` never blocks PO creation.
- ⚠️ Landed costs recorded but **never rolled into item cost** or PO totals.
- ⚠️ Purchase returns: posted is terminal (no cancel/reversal); restock/stock
  reversal handling thin.
- ⚠️ AP bill from received PO: manual and disconnected (see [02-sales-finance §AP](02-sales-finance.md)).
- ⚠️ No receiving-QC hook firing (inspection-on-receipt designed, unwired).

### Missing essentials
- ❌ RFQ / vendor quote comparison (request to N vendors, compare, award) —
  standard in Odoo/ERPNext/SAP B1.
- ❌ PO revision history after send (amend with version snapshot, like estimates).
- ❌ PO PDF + actual email to vendor (P5); vendor acknowledgment tracking.
- ❌ Blanket PO releases (call-offs against contract qty) if `poType` stays.
- ❌ Expected-receipts calendar; overdue-PO sweep (`po.overdue` event).

### Enterprise target model
*Benchmark: SAP B1 purchasing + Odoo purchase.*
- **Flow:** requisition (approval-routed) → optional RFQ/comparison → PO
  (threshold-based approval policy, PDF+email, revisions) → GRN (tolerance
  enforced, QC hold path, location putaway) → 3-way match (PO↔GRN↔bill,
  `matchStatus` computed, mismatches block bill approval) → landed cost
  allocation into valuation → returns with reversal.
- **Screens:** PO RecordPanel (lines, receipts, bills, landed costs, approvals,
  activity, attachments); requisition inbox; receiving queue ("expected today");
  match-exceptions screen.
- **Reporting:** spend by vendor/category/project, committed vs received vs
  billed, OTD per vendor, price-variance trend.
- **Automation:** `po.overdue` reminders, vendor scoring on receipt ([blueprint 04 §2](../04-module-relationship-map.md)),
  auto-bill draft on full receipt.

---

## 4. Vendors

### Exists today
- Vendor CRUD + detail page with tabs (contacts, addresses, bank accounts,
  vendor items, performance, related-doc counts); status active/inactive;
  GST/payment-terms/currency fields; CSV import/export. Approval-on-create wired.

### Half-baked (verified)
- ⚠️ Sub-records: addresses/banks are create+delete only (no edit); contacts
  only settable at vendor create; vendor items create-only.
- ⚠️ Dead flags: `isPreferred`, `onHold`, `isVerified` (bank) — no toggle API,
  no enforcement anywhere.
- ⚠️ `vendor_performance` table never written — performance tab has no data
  source.
- ⚠️ No delete guard (vendor with open POs hard-deletes).

### Missing essentials
- ❌ Vendor 360° financials: open balance, bills due, payment history, statement.
- ❌ Vendor document vault (contracts via DocSign designed, not wired) +
  expiry alerts (insurance/certifications) — critical for compliance buyers.
- ❌ Vendor portal (future tier) ; vendor price lists with validity windows
  (vendorItems has price but no history/validity).

### Enterprise target model
*Benchmark: Zoho Books vendors + ERPNext supplier scorecard.*
- Full sub-record CRUD; hold/preferred toggles with enforcement (hold blocks
  new POs and bills; preferred ranks pickers); bank verification step gating
  payment export.
- Vendor RecordPanel: Overview (balance, OTD score, quality ppm) / POs / Bills
  & payments / Items & prices / Documents (contracts, certs with expiry) /
  Contacts / Activity.
- `runVendorScoring` consumer fills `vendor_performance` from receipt timeliness,
  QC results, returns ([blueprint 04 §2](../04-module-relationship-map.md)).
- Compliance: supplier-audit inspections linkable (`evidence_for`), cert expiry
  sweep → notification.
