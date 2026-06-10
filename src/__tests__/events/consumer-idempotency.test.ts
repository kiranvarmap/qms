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
} from "@/lib/db/schema";
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
