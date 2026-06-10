/**
 * Consumer-loop idempotency tests (blueprint Phase 0.7). Runs under VITEST
 * (`npm run test:loops`), not jest — see vitest.config.ts.
 *
 * The outbox dispatcher retries failed events (up to MAX_ATTEMPTS), and a
 * consumer that fails mid-chain re-runs every consumer for that event. So the
 * contract is: running `runConsumers` twice with the SAME event must produce
 * exactly the same end state as running it once.
 *
 * Runs against a real in-memory Postgres (PGlite) with the full migration
 * history — see test-db.ts.
 */
import { randomUUID } from "crypto";
import { beforeAll, expect, test } from "vitest";

// `@/lib/db` is aliased to ./test-db by vitest.config.ts, so every module in
// the chain (consumers, outbox, inventory service) hits the PGlite instance.
import { db, ready } from "./test-db";
import {
  users,
  workspaces,
  boards,
  employees,
  inspectionTemplates,
  inspections,
  inspectionActions,
  items,
  entityLinks,
  activityFeed,
  vendors,
  products,
  warehouses,
  purchaseOrders,
  poLineItems,
  goodsReceipts,
  goodsReceiptLines,
  stockMovements,
  stockLevels,
  expenses,
  eventOutbox,
  courses,
  certifications,
  certificationRecords,
  purchaseRequisitions,
  requisitionLines,
  notifications,
  workspaceMembers,
  assets,
  workCenters,
  workCenterMachines,
  workOrders,
  jobStageSchedules,
  planningConflicts,
  customers,
  estimates,
  pmSchedules,
  maintenanceOrders,
  vendorPerformance,
} from "@/lib/db/schema";
import { sweepPmSchedules } from "@/lib/services/pm-generation";
import { sweepExpiredEstimates } from "@/lib/services/estimate-expiry";
import { releaseWorkOrder, completeWorkOrder, cancelWorkOrder } from "@/lib/services/production";
import { workOrderMaterials, stockLevels as stockLevelsTable } from "@/lib/db/schema";
import { runConsumers } from "@/lib/events/consumers";
import type { OutboxRow } from "@/lib/events/types";
import { and, eq } from "drizzle-orm";

// ── shared fixtures ──────────────────────────────────────────────────
let userId: string;
let workspaceId: string;

function makeEvent(partial: Partial<OutboxRow> & Pick<OutboxRow, "eventType">): OutboxRow {
  return {
    id: randomUUID(),
    workspaceId,
    aggregateType: "test",
    aggregateId: null,
    payload: {},
    actorUserId: userId,
    occurredAt: new Date(),
    attempts: 0,
    ...partial,
  } as OutboxRow;
}

beforeAll(async () => {
  await ready();

  const [u] = await db
    .insert(users)
    .values({ name: "Loop Tester", email: "loops@test.local", role: "admin" })
    .returning();
  userId = u.id;

  const [ws] = await db
    .insert(workspaces)
    .values({ name: "Loop WS", ownerId: userId })
    .returning();
  workspaceId = ws.id;
});

// ── 1. Activity feed projection dedupes on event id ─────────────────
test("activity feed: retried event projects exactly one timeline row", async () => {
  const [vendor] = await db
    .insert(vendors)
    .values({ workspaceId, name: "Feed Vendor" })
    .returning();

  const evt = makeEvent({
    eventType: "vendor.created",
    aggregateType: "vendor",
    aggregateId: vendor.id,
  });

  await runConsumers(evt);
  await runConsumers(evt); // simulated retry of the SAME outbox row

  const rows = await db.select().from(activityFeed).where(eq(activityFeed.eventId, evt.id));
  expect(rows).toHaveLength(1);
  expect(rows[0].action).toBe("vendor_created");
});

// ── 2. Quality loop creates one corrective task per action ──────────
test("quality loop: flagged inspection spawns exactly one task + link per action", async () => {
  const [board] = await db
    .insert(boards)
    .values({ workspaceId, name: "QC Board", createdBy: userId })
    .returning();

  const [template] = await db
    .insert(inspectionTemplates)
    .values({ title: "Line check", createdBy: userId })
    .returning();

  const [inspection] = await db
    .insert(inspections)
    .values({
      templateId: template.id,
      templateSnapshot: {},
      title: "Shift A inspection",
      workspaceId,
      boardId: board.id,
      conductedBy: userId,
    })
    .returning();

  await db
    .insert(inspectionActions)
    .values({ inspectionId: inspection.id, title: "Replace worn belt" });

  const evt = makeEvent({
    eventType: "inspection.flagged",
    aggregateType: "inspection",
    aggregateId: inspection.id,
  });

  await runConsumers(evt);
  await runConsumers(evt);

  const tasks = await db.select().from(items).where(eq(items.boardId, board.id));
  expect(tasks).toHaveLength(1);
  expect(tasks[0].name).toBe("Replace worn belt");

  const [action] = await db
    .select()
    .from(inspectionActions)
    .where(eq(inspectionActions.inspectionId, inspection.id));
  expect(action.itemId).toBe(tasks[0].id);

  const links = await db
    .select()
    .from(entityLinks)
    .where(and(eq(entityLinks.sourceId, inspection.id), eq(entityLinks.relation, "remediates")));
  expect(links).toHaveLength(1);
});

// ── 3. Approval subject sync transitions an expense exactly once ────
test("approval sync: double-delivered approval approves the expense once", async () => {
  const [emp] = await db
    .insert(employees)
    .values({ workspaceId, employeeId: "EMP-001", name: "Spender", userId })
    .returning();

  const [expense] = await db
    .insert(expenses)
    .values({
      workspaceId,
      docNumber: "EXP-001",
      employeeId: emp.id,
      amountMinor: 12_50,
      status: "submitted",
    })
    .returning();

  const evt = makeEvent({
    eventType: "approval.approved",
    aggregateType: "approval_request",
    aggregateId: randomUUID(),
    payload: { subjectType: "expense", subjectId: expense.id },
  });

  await runConsumers(evt);
  await runConsumers(evt);

  const [after] = await db.select().from(expenses).where(eq(expenses.id, expense.id));
  expect(after.status).toBe("approved");

  // The subject's own domain event must be emitted exactly once.
  const emitted = await db
    .select()
    .from(eventOutbox)
    .where(and(eq(eventOutbox.eventType, "expense.approved"), eq(eventOutbox.aggregateId, expense.id)));
  expect(emitted).toHaveLength(1);
});

// ── 4. Stock ledger posts a goods receipt exactly once ──────────────
test("stock ledger: retried po.received posts one receipt movement", async () => {
  const [vendor] = await db
    .insert(vendors)
    .values({ workspaceId, name: "Stock Vendor" })
    .returning();
  const [product] = await db
    .insert(products)
    .values({ workspaceId, name: "Widget", sku: "WID-1" })
    .returning();
  const [warehouse] = await db
    .insert(warehouses)
    .values({ workspaceId, name: "Main WH" })
    .returning();

  const [po] = await db
    .insert(purchaseOrders)
    .values({ workspaceId, vendorId: vendor.id, docNumber: "PO-001", createdBy: userId })
    .returning();
  const [line] = await db
    .insert(poLineItems)
    .values({ purchaseOrderId: po.id, description: "Widget", productId: product.id, quantity: 10, unitCostMinor: 100 })
    .returning();

  const [grn] = await db
    .insert(goodsReceipts)
    .values({
      workspaceId,
      purchaseOrderId: po.id,
      docNumber: "GRN-001",
      warehouseId: warehouse.id,
      receivedBy: userId,
    })
    .returning();
  await db
    .insert(goodsReceiptLines)
    .values({ goodsReceiptId: grn.id, poLineItemId: line.id, productId: product.id, quantity: 10 });

  const evt = makeEvent({
    eventType: "po.received",
    aggregateType: "purchase_order",
    aggregateId: po.id,
    payload: { goodsReceiptId: grn.id },
  });

  await runConsumers(evt);
  await runConsumers(evt);

  const movements = await db
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.refType, "goods_receipt"), eq(stockMovements.refId, grn.id)));
  expect(movements).toHaveLength(1);

  const [level] = await db
    .select()
    .from(stockLevels)
    .where(and(eq(stockLevels.productId, product.id), eq(stockLevels.warehouseId, warehouse.id)));
  expect(level.onHand).toBe(10);
});

// ── 5. Certification issuance mints one record ──────────────────────
test("certification issue: retried course.completed mints one record", async () => {
  const [emp] = await db
    .insert(employees)
    .values({ workspaceId, employeeId: "EMP-002", name: "Learner" })
    .returning();
  const [course] = await db
    .insert(courses)
    .values({ workspaceId, title: "Forklift safety", createdBy: userId })
    .returning();
  const [cert] = await db
    .insert(certifications)
    .values({ workspaceId, name: "Forklift licence", validityMonths: 12, requiresCourseId: course.id })
    .returning();

  const evt = makeEvent({
    eventType: "course.completed",
    aggregateType: "course",
    aggregateId: course.id,
    payload: { employeeId: emp.id },
  });

  await runConsumers(evt);
  await runConsumers(evt);

  const records = await db
    .select()
    .from(certificationRecords)
    .where(and(eq(certificationRecords.employeeId, emp.id), eq(certificationRecords.certificationId, cert.id)));
  expect(records).toHaveLength(1);
  expect(records[0].status).toBe("valid");
});

// ── 6. Replenishment drafts one requisition per low-stock product ───
test("replenishment: repeated stock.low yields one open draft requisition", async () => {
  const [product] = await db
    .insert(products)
    .values({ workspaceId, name: "Bolt M8", sku: "BOLT-8", reorderLevel: 50 })
    .returning();

  const evt = makeEvent({
    eventType: "stock.low",
    aggregateType: "product",
    aggregateId: product.id,
    payload: { available: 10, reorderLevel: 50, name: product.name },
  });

  await runConsumers(evt);
  await runConsumers(evt);
  // A second, distinct low-stock signal must also not duplicate while one is open.
  await runConsumers(makeEvent({
    eventType: "stock.low",
    aggregateType: "product",
    aggregateId: product.id,
    payload: { available: 8, reorderLevel: 50, name: product.name },
  }));

  const lines = await db
    .select()
    .from(requisitionLines)
    .where(eq(requisitionLines.productId, product.id));
  expect(lines).toHaveLength(1);
  expect(lines[0].quantity).toBe(40); // reorder 50 − available 10

  const [req] = await db
    .select()
    .from(purchaseRequisitions)
    .where(eq(purchaseRequisitions.id, lines[0].requisitionId));
  expect(req.status).toBe("draft");
});

// ── 7. Safety escalation pages admins exactly once ──────────────────
test("safety escalation: critical incident notifies admins once", async () => {
  await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role: "owner" })
    .onConflictDoNothing();

  const evt = makeEvent({
    eventType: "incident.reported",
    aggregateType: "incident",
    aggregateId: randomUUID(),
    payload: { number: "INC-001", type: "injury", severity: "critical" },
  });

  await runConsumers(evt);
  await runConsumers(evt);

  const pings = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, "incident_escalation")));
  expect(pings).toHaveLength(1);
});

// ── 8. Asset downtime raises one blocker per scheduled stage ────────
test("asset downtime: status change flags affected stage schedules once", async () => {
  const [asset] = await db
    .insert(assets)
    .values({ workspaceId, code: "CNC-1", name: "CNC mill", status: "up" })
    .returning();
  const [wc] = await db
    .insert(workCenters)
    .values({ workspaceId, name: "Machining" })
    .returning();
  const [machine] = await db
    .insert(workCenterMachines)
    .values({ workspaceId, workCenterId: wc.id, assetId: asset.id, name: "CNC mill #1" })
    .returning();
  const [product] = await db
    .insert(products)
    .values({ workspaceId, name: "Bracket", sku: "BRK-1" })
    .returning();
  const [wo] = await db
    .insert(workOrders)
    .values({ workspaceId, number: "WO-001", productId: product.id, qtyPlanned: 5, createdBy: userId })
    .returning();
  await db.insert(jobStageSchedules).values({
    workspaceId,
    workOrderId: wo.id,
    stageName: "Milling",
    assignedWorkCenterId: wc.id,
    assignedMachineId: machine.id,
    status: "pending",
  });

  const evt = makeEvent({
    eventType: "asset.status_changed",
    aggregateType: "asset",
    aggregateId: asset.id,
    payload: { from: "up", to: "down" },
  });

  await runConsumers(evt);
  await runConsumers(evt);

  const conflicts = await db
    .select()
    .from(planningConflicts)
    .where(and(eq(planningConflicts.workOrderId, wo.id), eq(planningConflicts.conflictType, "maintenance_block")));
  expect(conflicts).toHaveLength(1);
  expect(conflicts[0].severity).toBe("blocker");
  expect(conflicts[0].status).toBe("open");
});

// ── 9. PM sweep generates one order and rolls the schedule forward ──
test("pm generation: due schedule spawns one preventive order per cycle", async () => {
  const [asset] = await db
    .insert(assets)
    .values({ workspaceId, code: "PRESS-1", name: "Hydraulic press", status: "up" })
    .returning();

  const due = new Date(Date.now() - 86_400_000); // due yesterday
  const [sched] = await db
    .insert(pmSchedules)
    .values({ workspaceId, assetId: asset.id, name: "Monthly lube", intervalDays: 30, nextDue: due })
    .returning();

  await sweepPmSchedules();
  await sweepPmSchedules(); // re-sweep must not double-generate

  const orders = await db
    .select()
    .from(maintenanceOrders)
    .where(and(eq(maintenanceOrders.assetId, asset.id), eq(maintenanceOrders.type, "preventive")));
  expect(orders).toHaveLength(1);
  expect(orders[0].fault).toContain("Monthly lube");

  const [after] = await db.select().from(pmSchedules).where(eq(pmSchedules.id, sched.id));
  expect(after.isActive).toBe(true);
  expect(after.nextDue!.getTime()).toBe(due.getTime() + 30 * 86_400_000);

  // One-shot schedule deactivates after generating.
  const [oneShot] = await db
    .insert(pmSchedules)
    .values({ workspaceId, assetId: asset.id, name: "Commissioning check", intervalDays: 0, nextDue: due })
    .returning();
  await sweepPmSchedules();
  const [oneShotAfter] = await db.select().from(pmSchedules).where(eq(pmSchedules.id, oneShot.id));
  expect(oneShotAfter.isActive).toBe(false);
});

// ── 10. Vendor scoring recomputes one rolling row ────────────────────
test("vendor scoring: po.received maintains a single all-time scorecard row", async () => {
  const [vendor] = await db
    .insert(vendors)
    .values({ workspaceId, name: "Score Vendor" })
    .returning();
  const [po] = await db
    .insert(purchaseOrders)
    .values({
      workspaceId,
      vendorId: vendor.id,
      docNumber: "PO-SCORE-1",
      createdBy: userId,
      expectedDate: new Date(Date.now() + 86_400_000), // promised tomorrow
    })
    .returning();
  await db.insert(goodsReceipts).values({
    workspaceId,
    purchaseOrderId: po.id,
    docNumber: "GRN-SCORE-1",
    receivedBy: userId,
  });

  const evt = makeEvent({
    eventType: "po.received",
    aggregateType: "purchase_order",
    aggregateId: po.id,
    payload: {},
  });

  await runConsumers(evt);
  await runConsumers(evt);

  const rows = await db
    .select()
    .from(vendorPerformance)
    .where(eq(vendorPerformance.vendorId, vendor.id));
  expect(rows).toHaveLength(1);
  expect(rows[0].onTimePct).toBe(100);
  expect(rows[0].rating).toBe(5);
});

// ── 11. Estimate expiry flips open quotes exactly once ──────────────
test("estimate expiry: sweep expires sent quotes once and emits once", async () => {
  const [customer] = await db
    .insert(customers)
    .values({ workspaceId, name: "Expiry Customer" })
    .returning();
  const [est] = await db
    .insert(estimates)
    .values({
      workspaceId,
      customerId: customer.id,
      docNumber: "EST-EXP-1",
      status: "sent",
      validUntil: new Date(Date.now() - 86_400_000),
      createdBy: userId,
    })
    .returning();

  await sweepExpiredEstimates();
  await sweepExpiredEstimates();

  const [after] = await db.select().from(estimates).where(eq(estimates.id, est.id));
  expect(after.status).toBe("expired");

  const emitted = await db
    .select()
    .from(eventOutbox)
    .where(and(eq(eventOutbox.eventType, "estimate.expired"), eq(eventOutbox.aggregateId, est.id)));
  expect(emitted).toHaveLength(1);
});

// ── 15. Approval SLA escalates an overdue step exactly once ─────────
test("approval sla: overdue step notifies approver + manager + requester once", async () => {
  const { approvalRequests, approvalSteps } = await import("@/lib/db/schema");
  const { sweepApprovalSlas } = await import("@/lib/services/approval-sla");

  // Manager chain: approver reports to manager; both have user accounts.
  const [mgrUser] = await db
    .insert(users)
    .values({ name: "Mgr", email: "mgr@test.local", role: "manager" })
    .returning();
  const [mgrEmp] = await db
    .insert(employees)
    .values({ workspaceId, employeeId: "EMP-MGR", name: "Mgr", userId: mgrUser.id })
    .returning();
  const [apprUser] = await db
    .insert(users)
    .values({ name: "Approver", email: "approver@test.local", role: "user" })
    .returning();
  const [apprEmp] = await db
    .insert(employees)
    .values({ workspaceId, employeeId: "EMP-APPR", name: "Approver", userId: apprUser.id, managerEmployeeId: mgrEmp.id })
    .returning();

  const [req] = await db
    .insert(approvalRequests)
    .values({ workspaceId, subjectType: "expense", subjectId: randomUUID(), requestedBy: userId, currentStep: 1 })
    .returning();
  await db.insert(approvalSteps).values({
    requestId: req.id,
    stepNumber: 1,
    approverEmployeeId: apprEmp.id,
    dueAt: new Date(Date.now() - 3_600_000), // due an hour ago
  });

  await sweepApprovalSlas();
  await sweepApprovalSlas(); // escalatedAt guard → no double-page

  const apprPings = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, apprUser.id), eq(notifications.type, "approval_overdue")));
  expect(apprPings).toHaveLength(1);

  const mgrPings = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, mgrUser.id), eq(notifications.type, "approval_escalated")));
  expect(mgrPings).toHaveLength(1);

  const overdueEvents = await db
    .select()
    .from(eventOutbox)
    .where(and(eq(eventOutbox.eventType, "approval.overdue"), eq(eventOutbox.aggregateId, req.id)));
  expect(overdueEvents).toHaveLength(1);
});

// ── 14. Receiving QC spawns one inspection per GRN ──────────────────
test("receiving qc: po.received spawns one linked inspection for QC products", async () => {
  const { inspectionTemplates, inspections } = await import("@/lib/db/schema");

  const [template] = await db
    .insert(inspectionTemplates)
    .values({ title: "Incoming goods check", createdBy: userId })
    .returning();
  const [vendor] = await db
    .insert(vendors)
    .values({ workspaceId, name: "QC Vendor" })
    .returning();
  const [product] = await db
    .insert(products)
    .values({ workspaceId, name: "Casting", sku: "CAST-1", qcRequired: true, qcTemplateId: template.id })
    .returning();
  const [warehouse] = await db
    .insert(warehouses)
    .values({ workspaceId, name: "QC WH" })
    .returning();
  const [po] = await db
    .insert(purchaseOrders)
    .values({ workspaceId, vendorId: vendor.id, docNumber: "PO-QC-1", createdBy: userId })
    .returning();
  const [line] = await db
    .insert(poLineItems)
    .values({ purchaseOrderId: po.id, description: "Casting", productId: product.id, quantity: 3, unitCostMinor: 100 })
    .returning();
  const [grn] = await db
    .insert(goodsReceipts)
    .values({ workspaceId, purchaseOrderId: po.id, docNumber: "GRN-QC-1", warehouseId: warehouse.id, receivedBy: userId })
    .returning();
  await db
    .insert(goodsReceiptLines)
    .values({ goodsReceiptId: grn.id, poLineItemId: line.id, productId: product.id, quantity: 3 });

  const evt = makeEvent({
    eventType: "po.received",
    aggregateType: "purchase_order",
    aggregateId: po.id,
    payload: { goodsReceiptId: grn.id },
  });

  await runConsumers(evt);
  await runConsumers(evt);

  const links = await db
    .select()
    .from(entityLinks)
    .where(and(eq(entityLinks.targetType, "goods_receipt"), eq(entityLinks.targetId, grn.id)));
  expect(links).toHaveLength(1);

  const [insp] = await db.select().from(inspections).where(eq(inspections.id, links[0].sourceId));
  expect(insp.title).toContain("GRN-QC-1");
  expect(insp.title).toContain("Casting");
  expect(insp.status).toBe("in_progress");
  expect(insp.templateId).toBe(template.id);
});

// ── 13. GL posting books each financial event exactly once ──────────
test("gl posting: invoice issue, payment, and void each book one balanced entry", async () => {
  const { invoices, payments, journalEntries, journalLines, ledgerAccounts } = await import("@/lib/db/schema");

  const [customer] = await db
    .insert(customers)
    .values({ workspaceId, name: "GL Customer" })
    .returning();
  const [inv] = await db
    .insert(invoices)
    .values({
      workspaceId,
      customerId: customer.id,
      docNumber: "INV-GL-1",
      status: "sent",
      subtotalMinor: 1000,
      taxMinor: 100,
      totalMinor: 1100,
      createdBy: userId,
    })
    .returning();

  const issueEvt = makeEvent({ eventType: "invoice.sent", aggregateType: "invoice", aggregateId: inv.id });
  await runConsumers(issueEvt);
  await runConsumers(issueEvt);

  const issued = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, "invoice.sent"), eq(journalEntries.sourceId, inv.id)));
  expect(issued).toHaveLength(1);
  expect(issued[0].status).toBe("posted");

  const issuedLines = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, issued[0].id));
  const debits = issuedLines.reduce((s, l) => s + l.debitMinor, 0);
  const credits = issuedLines.reduce((s, l) => s + l.creditMinor, 0);
  expect(debits).toBe(1100);
  expect(credits).toBe(1100);

  // System accounts were created by convention.
  const accounts = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.workspaceId, workspaceId));
  const codes = accounts.map((a) => a.code);
  expect(codes).toContain("1100"); // AR
  expect(codes).toContain("4000"); // Revenue
  expect(codes).toContain("2200"); // Tax

  // Payment → Dr Cash / Cr AR, once.
  const [pay] = await db
    .insert(payments)
    .values({ workspaceId, invoiceId: inv.id, amountMinor: 500 })
    .returning();
  const payEvt = makeEvent({
    eventType: "payment.recorded",
    aggregateType: "payment",
    aggregateId: pay.id,
    payload: { invoiceId: inv.id },
  });
  await runConsumers(payEvt);
  await runConsumers(payEvt);
  const payJes = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, "payment.recorded"), eq(journalEntries.sourceId, pay.id)));
  expect(payJes).toHaveLength(1);

  // Void → one reversing entry mirroring the issue lines.
  const voidEvt = makeEvent({ eventType: "invoice.voided", aggregateType: "invoice", aggregateId: inv.id });
  await runConsumers(voidEvt);
  await runConsumers(voidEvt);
  const reversals = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.sourceType, "invoice.voided"), eq(journalEntries.sourceId, inv.id)));
  expect(reversals).toHaveLength(1);
  const revLines = await db.select().from(journalLines).where(eq(journalLines.journalEntryId, reversals[0].id));
  expect(revLines.reduce((s, l) => s + l.debitMinor, 0)).toBe(1100);
  expect(revLines.reduce((s, l) => s + l.creditMinor, 0)).toBe(1100);
});

// ── 12b. Approval sync approves a sales order exactly once ──────────
test("approval sync: sales order approval reserves stock once; rejection returns to draft", async () => {
  const { salesOrders, salesOrderLineItems } = await import("@/lib/db/schema");

  const [customer] = await db
    .insert(customers)
    .values({ workspaceId, name: "SO Customer" })
    .returning();
  const [warehouse] = await db
    .insert(warehouses)
    .values({ workspaceId, name: "SO WH" })
    .returning();
  const [product] = await db
    .insert(products)
    .values({ workspaceId, name: "Gear", sku: "GEAR-1", trackInventory: true })
    .returning();

  const [so] = await db
    .insert(salesOrders)
    .values({
      workspaceId,
      customerId: customer.id,
      docNumber: "SO-APPR-1",
      status: "pending_approval",
      warehouseId: warehouse.id,
      createdBy: userId,
    })
    .returning();
  await db.insert(salesOrderLineItems).values({
    salesOrderId: so.id,
    productId: product.id,
    description: "Gear",
    quantity: 4,
    unitPriceMinor: 1000,
  });

  const evt = makeEvent({
    eventType: "approval.approved",
    aggregateType: "approval_request",
    aggregateId: randomUUID(),
    payload: { subjectType: "sales_order", subjectId: so.id },
  });

  await runConsumers(evt);
  await runConsumers(evt);

  const [after] = await db.select().from(salesOrders).where(eq(salesOrders.id, so.id));
  expect(after.status).toBe("reserved");

  const movements = await db
    .select()
    .from(stockMovements)
    .where(and(eq(stockMovements.refType, "sales_order"), eq(stockMovements.refId, so.id)));
  expect(movements).toHaveLength(1);
  expect(movements[0].committedDelta).toBe(4);

  // Rejection path: a second pending order returns to draft.
  const [so2] = await db
    .insert(salesOrders)
    .values({
      workspaceId,
      customerId: customer.id,
      docNumber: "SO-APPR-2",
      status: "pending_approval",
      createdBy: userId,
    })
    .returning();
  await runConsumers(makeEvent({
    eventType: "approval.rejected",
    aggregateType: "approval_request",
    aggregateId: randomUUID(),
    payload: { subjectType: "sales_order", subjectId: so2.id },
  }));
  const [so2After] = await db.select().from(salesOrders).where(eq(salesOrders.id, so2.id));
  expect(so2After.status).toBe("draft");
});

// ── 12. Work-order stock cycle: reserve on release, settle on complete ──
test("work order: release reserves materials, completion consumes and releases", async () => {
  const [warehouse] = await db
    .insert(warehouses)
    .values({ workspaceId, name: "WO WH" })
    .returning();
  const [component] = await db
    .insert(products)
    .values({ workspaceId, name: "Steel rod", sku: "ROD-1", trackInventory: true })
    .returning();
  const [fg] = await db
    .insert(products)
    .values({ workspaceId, name: "Axle", sku: "AXLE-1", trackInventory: true })
    .returning();
  await db.insert(stockLevelsTable).values({
    workspaceId,
    productId: component.id,
    warehouseId: warehouse.id,
    onHand: 100,
    committed: 0,
  });

  async function makeWo(number: string) {
    const [wo] = await db
      .insert(workOrders)
      .values({ workspaceId, number, productId: fg.id, qtyPlanned: 5, warehouseId: warehouse.id, createdBy: userId })
      .returning();
    await db.insert(workOrderMaterials).values({
      workOrderId: wo.id,
      componentProductId: component.id,
      qtyRequired: 10,
    });
    return wo;
  }

  async function level(productId: string) {
    const [l] = await db
      .select()
      .from(stockLevelsTable)
      .where(and(eq(stockLevelsTable.productId, productId), eq(stockLevelsTable.warehouseId, warehouse.id)));
    return l ?? { onHand: 0, committed: 0 };
  }

  // Release → committed rises; double release is a no-op (claim guard).
  const wo1 = await makeWo("WO-CYCLE-1");
  expect(await releaseWorkOrder(workspaceId, wo1.id, userId)).not.toBeNull();
  expect(await releaseWorkOrder(workspaceId, wo1.id, userId)).toBeNull();
  expect((await level(component.id)).committed).toBe(10);

  // Complete → component consumed once, reservation released, FG received.
  const result = await completeWorkOrder(workspaceId, wo1.id, {}, userId);
  expect("error" in result).toBe(false);
  const compAfter = await level(component.id);
  expect(compAfter.onHand).toBe(90);
  expect(compAfter.committed).toBe(0);
  expect((await level(fg.id)).onHand).toBe(5);

  // Cancel after release → reservation fully returned, nothing consumed.
  const wo2 = await makeWo("WO-CYCLE-2");
  await releaseWorkOrder(workspaceId, wo2.id, userId);
  expect((await level(component.id)).committed).toBe(10);
  expect(await cancelWorkOrder(workspaceId, wo2.id, userId)).not.toBeNull();
  const compFinal = await level(component.id);
  expect(compFinal.committed).toBe(0);
  expect(compFinal.onHand).toBe(90);
});
