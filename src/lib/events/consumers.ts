/**
 * Event consumers — the cross-module business loops (Plan B.3 / E.2).
 *
 * Each consumer is a pure-ish function over one outbox row. The dispatcher
 * (dispatcher.ts) runs them in order. Consumers are idempotent where it
 * matters (they check before creating) so a retried event is safe.
 *
 *   Quality loop : inspection.flagged → create a corrective-action board task
 *   Labor loop   : timelog.checked_out → roll minutes up to the linked item
 *   Notifications: every event → in-app / email per user preference
 *   Activity feed: every meaningful event → one denormalized timeline row
 */

import { db } from "@/lib/db";
import {
  activityFeed,
  boards,
  groups,
  items,
  inspections,
  inspectionActions,
  entityLinks,
  notifications,
  notificationPreferences,
  timeLogs,
  workspaceMembers,
  users,
  approvalRequests,
  employees,
  purchaseOrders,
  goodsReceipts,
  goodsReceiptLines,
  poLineItems,
  stockMovements,
  expenses,
  vendors,
  leaveRequests,
  leaveBalances,
  certifications,
  certificationRecords,
  products,
  purchaseRequisitions,
  requisitionLines,
  workCenterMachines,
  jobStageSchedules,
  planningConflicts,
  vendorPerformance,
  salesOrders,
} from "@/lib/db/schema";
import { reserveAndApproveSalesOrder } from "@/lib/services/sales-orders";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { nextDocNumber } from "@/lib/services/document-sequence";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { emitEventStandalone } from "./outbox";
import { applyStockMovement } from "@/lib/services/inventory";
import type { OutboxRow } from "./types";

const CORRECTIVE_GROUP_NAME = "Corrective Actions";

// ── Quality loop ─────────────────────────────────────────────────────
// A flagged inspection spawns a real board task and wires it back so the
// action and the task stay in sync. (Plan E.2 Workflow 1.)
async function runQualityLoop(evt: OutboxRow): Promise<void> {
  if (evt.eventType !== "inspection.flagged" && evt.eventType !== "inspection.submitted") return;

  const inspectionId = evt.aggregateId;
  if (!inspectionId) return;

  const [inspection] = await db.select().from(inspections).where(eq(inspections.id, inspectionId)).limit(1);
  if (!inspection) return;

  // Target board: the inspection's linked board, else the template's board.
  const targetBoardId = inspection.boardId;
  if (!targetBoardId) {
    logger?.info?.("quality-loop: no target board for flagged inspection; skipping task creation", {
      inspectionId,
    });
    return;
  }

  // Open corrective actions that have not yet been turned into tasks.
  const openActions = await db
    .select()
    .from(inspectionActions)
    .where(and(eq(inspectionActions.inspectionId, inspectionId), isNull(inspectionActions.itemId)));

  if (openActions.length === 0) return;

  // Find or create the "Corrective Actions" group on the target board.
  const [existingGroup] = await db
    .select()
    .from(groups)
    .where(and(eq(groups.boardId, targetBoardId), eq(groups.name, CORRECTIVE_GROUP_NAME)))
    .limit(1);

  let groupId = existingGroup?.id;
  if (!groupId) {
    const [g] = await db
      .insert(groups)
      .values({ boardId: targetBoardId, name: CORRECTIVE_GROUP_NAME, color: "#ef4444" })
      .returning();
    groupId = g.id;
  }

  for (const action of openActions) {
    const [item] = await db
      .insert(items)
      .values({
        boardId: targetBoardId,
        groupId,
        workspaceId: inspection.workspaceId ?? evt.workspaceId ?? null,
        name: action.title,
        createdBy: inspection.conductedBy,
      })
      .returning();

    await db
      .update(inspectionActions)
      .set({ itemId: item.id, boardId: targetBoardId, workspaceId: inspection.workspaceId ?? null })
      .where(eq(inspectionActions.id, action.id));

    // Loose link: this inspection "remediates" the new task.
    await db
      .insert(entityLinks)
      .values({
        workspaceId: inspection.workspaceId ?? null,
        sourceType: "inspection",
        sourceId: inspectionId,
        targetType: "item",
        targetId: item.id,
        relation: "remediates",
        createdBy: inspection.conductedBy,
      })
      .onConflictDoNothing();
  }
}

// ── Labor loop ───────────────────────────────────────────────────────
// On clock-out, roll the shift's minutes up to the linked board item by
// recording an activity_feed entry (the item-level roll-up read model).
// (Plan E.2 Workflow 4.) Aggregation onto a cell column is left to a board
// configuration step; the durable fact lives on the time_log + feed.
async function runLaborRollup(evt: OutboxRow): Promise<void> {
  if (evt.eventType !== "timelog.checked_out") return;
  const timeLogId = evt.aggregateId;
  if (!timeLogId) return;

  const [log] = await db.select().from(timeLogs).where(eq(timeLogs.id, timeLogId)).limit(1);
  if (!log || !log.itemId) return;
  // The activity-feed consumer already records the event with ancestry;
  // nothing more to mutate here. Hook kept explicit for future cost roll-ups.
}

// ── Approval routing (Plan §2.4) ─────────────────────────────────────
// Directed notifications for the generic approval engine: on each pending
// step, ping the current approver; on resolution, ping the requester. This
// is targeted (one user), distinct from the broadcast runNotifications below.
async function approverUserId(approverEmployeeId?: string | null): Promise<string | null> {
  if (!approverEmployeeId) return null;
  const [emp] = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(eq(employees.id, approverEmployeeId))
    .limit(1);
  return emp?.userId ?? null;
}

async function notifyUser(
  userId: string,
  type: string,
  title: string,
  body: string,
  meta: Record<string, unknown>
): Promise<void> {
  await db.insert(notifications).values({ userId, type, title, body, meta });
}

async function runApprovalRouting(evt: OutboxRow): Promise<void> {
  const p = evt.payload ?? {};
  if (evt.eventType === "approval.requested") {
    const target = await approverUserId(p.approverEmployeeId as string | undefined);
    if (!target) return; // role-only step: broadcast handled elsewhere / admin inbox
    await notifyUser(
      target,
      "approval_requested",
      "Approval needed",
      `A ${String(p.subjectType ?? "request").replace(/_/g, " ")} is awaiting your approval.`,
      { eventId: evt.id, requestId: evt.aggregateId, subjectType: p.subjectType, subjectId: p.subjectId }
    );
    return;
  }

  if (evt.eventType === "approval.approved" || evt.eventType === "approval.rejected") {
    if (!evt.aggregateId) return;
    const [req] = await db
      .select({ requestedBy: approvalRequests.requestedBy })
      .from(approvalRequests)
      .where(eq(approvalRequests.id, evt.aggregateId))
      .limit(1);
    if (!req?.requestedBy) return;
    const approved = evt.eventType === "approval.approved";
    await notifyUser(
      req.requestedBy,
      evt.eventType.replace(".", "_"),
      approved ? "Request approved" : "Request rejected",
      `Your ${String(p.subjectType ?? "request").replace(/_/g, " ")} was ${approved ? "approved" : "rejected"}.`,
      { eventId: evt.id, requestId: evt.aggregateId, subjectType: p.subjectType, subjectId: p.subjectId }
    );
  }
}

// ── Approval subject sync (Plan §5) ──────────────────────────────────
// When a generic approval resolves, reflect the outcome on the subject it
// governs and emit the subject's own domain event. Decoupled: the subject
// module never imports the approval engine's decision path. Idempotent —
// only transitions a still-pending subject. Extended per phase (PO now;
// expense / invoice / leave added with their modules).
async function runApprovalSubjectSync(evt: OutboxRow): Promise<void> {
  if (evt.eventType !== "approval.approved" && evt.eventType !== "approval.rejected") return;
  const approved = evt.eventType === "approval.approved";
  const subjectType = (evt.payload?.subjectType as string) ?? null;
  const subjectId = (evt.payload?.subjectId as string) ?? null;
  if (!subjectType || !subjectId) return;

  if (subjectType === "purchase_order") {
    const [po] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, subjectId)).limit(1);
    if (!po || po.status !== "pending_approval") return; // idempotent guard
    await db
      .update(purchaseOrders)
      .set({ status: approved ? "approved" : "cancelled", updatedAt: new Date() })
      .where(eq(purchaseOrders.id, subjectId));
    await emitEventStandalone({
      workspaceId: po.workspaceId,
      eventType: approved ? "po.approved" : "po.rejected",
      aggregateType: "purchase_order",
      aggregateId: po.id,
      actorUserId: evt.actorUserId,
      payload: { docNumber: po.docNumber, vendorId: po.vendorId, boardId: po.boardId, itemId: po.itemId },
    });
  } else if (subjectType === "vendor") {
    const [v] = await db.select().from(vendors).where(eq(vendors.id, subjectId)).limit(1);
    if (!v || v.approvalState !== "pending") return; // idempotent guard
    await db
      .update(vendors)
      .set({ approvalState: approved ? "approved" : "rejected", status: approved ? "active" : "inactive", updatedAt: new Date() })
      .where(eq(vendors.id, subjectId));
    if (approved) {
      await emitEventStandalone({
        workspaceId: v.workspaceId,
        eventType: "vendor.created",
        aggregateType: "vendor",
        aggregateId: v.id,
        actorUserId: evt.actorUserId,
        payload: { code: v.code, name: v.name },
      });
    }
  } else if (subjectType === "expense") {
    const [exp] = await db.select().from(expenses).where(eq(expenses.id, subjectId)).limit(1);
    if (!exp || exp.status !== "submitted") return; // idempotent guard
    await db
      .update(expenses)
      .set({ status: approved ? "approved" : "rejected", updatedAt: new Date() })
      .where(eq(expenses.id, subjectId));
    await emitEventStandalone({
      workspaceId: exp.workspaceId,
      eventType: approved ? "expense.approved" : "expense.rejected",
      aggregateType: "expense",
      aggregateId: exp.id,
      actorUserId: evt.actorUserId,
      payload: { docNumber: exp.docNumber, employeeId: exp.employeeId, boardId: exp.boardId, itemId: exp.itemId },
    });
  } else if (subjectType === "sales_order") {
    const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, subjectId)).limit(1);
    if (!so || so.status !== "pending_approval") return; // idempotent guard
    if (approved) {
      // Shared path with the direct approve route: reserve tracked lines and
      // mark approved/reserved; emits salesorder.approved itself.
      const result = await reserveAndApproveSalesOrder(so.workspaceId, so.id, evt.actorUserId ?? null);
      if ("error" in result && result.error === "warehouse_required") {
        // Approved but unreservable (no warehouse on the order): record the
        // decision without stock impact; ops sets a warehouse then reserves.
        await db
          .update(salesOrders)
          .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
          .where(eq(salesOrders.id, subjectId));
      }
    } else {
      // Rejected orders return to draft so sales can rework and resubmit.
      await db
        .update(salesOrders)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(salesOrders.id, subjectId));
    }
  } else if (subjectType === "leave_request") {
    const [lr] = await db.select().from(leaveRequests).where(eq(leaveRequests.id, subjectId)).limit(1);
    if (!lr || lr.status !== "pending") return; // idempotent guard
    await db
      .update(leaveRequests)
      .set({ status: approved ? "approved" : "rejected", updatedAt: new Date() })
      .where(eq(leaveRequests.id, subjectId));

    // On approval, roll the days into the matching period balance.
    if (approved) {
      const year = lr.startDate.getUTCFullYear();
      await db
        .insert(leaveBalances)
        .values({
          workspaceId: lr.workspaceId,
          employeeId: lr.employeeId,
          leaveTypeId: lr.leaveTypeId,
          periodYear: year,
          takenDays: lr.days,
        })
        .onConflictDoUpdate({
          target: [leaveBalances.employeeId, leaveBalances.leaveTypeId, leaveBalances.periodYear],
          set: { takenDays: sql`${leaveBalances.takenDays} + ${lr.days}`, updatedAt: new Date() },
        });
    }

    await emitEventStandalone({
      workspaceId: lr.workspaceId,
      eventType: approved ? "leave.approved" : "leave.rejected",
      aggregateType: "leave_request",
      aggregateId: lr.id,
      actorUserId: evt.actorUserId,
      payload: { employeeId: lr.employeeId, days: lr.days },
    });
  }
}

// ── Stock ledger (Plan §4 / §6.3) ────────────────────────────────────
// On goods receipt, raise on-hand for each received line that maps to a
// tracked product, into the receipt's destination warehouse. Idempotent:
// skips if movements already exist for this GRN (refType/refId guard), so a
// retried `po.received` never double-counts. Lines without a product or with
// no warehouse on the GRN are skipped (free-text / un-located receipts).
async function runStockLedger(evt: OutboxRow): Promise<void> {
  if (evt.eventType !== "po.received") return;
  const grnId = (evt.payload?.goodsReceiptId as string) ?? null;
  if (!grnId) return;

  const [grn] = await db.select().from(goodsReceipts).where(eq(goodsReceipts.id, grnId)).limit(1);
  if (!grn || !grn.warehouseId) return; // no destination → nothing to post

  // Idempotency guard — already posted for this receipt?
  const [existing] = await db
    .select({ id: stockMovements.id })
    .from(stockMovements)
    .where(and(eq(stockMovements.refType, "goods_receipt"), eq(stockMovements.refId, grnId)))
    .limit(1);
  if (existing) return;

  const lines = await db
    .select({
      productId: goodsReceiptLines.productId,
      quantity: goodsReceiptLines.quantity,
      lineProductId: poLineItems.productId,
    })
    .from(goodsReceiptLines)
    .leftJoin(poLineItems, eq(poLineItems.id, goodsReceiptLines.poLineItemId))
    .where(eq(goodsReceiptLines.goodsReceiptId, grnId));

  await db.transaction(async (tx) => {
    for (const line of lines) {
      const productId = line.productId ?? line.lineProductId;
      if (!productId || line.quantity <= 0) continue;
      await applyStockMovement(tx, {
        workspaceId: grn.workspaceId,
        productId,
        warehouseId: grn.warehouseId!,
        type: "receipt",
        quantity: line.quantity,
        refType: "goods_receipt",
        refId: grnId,
        actorUserId: evt.actorUserId,
      });
    }
  });
}

// ── Certification issuance (Plan §9) ─────────────────────────────────
// On course completion, mint a certification_record for every certification
// that requires this course. Idempotent: skips if a valid record already
// exists for the employee × certification.
async function runCertificationIssue(evt: OutboxRow): Promise<void> {
  if (evt.eventType !== "course.completed") return;
  const courseId = evt.aggregateId;
  const employeeId = (evt.payload?.employeeId as string) ?? null;
  if (!courseId || !employeeId) return;

  const defs = await db.select().from(certifications).where(eq(certifications.requiresCourseId, courseId));
  for (const def of defs) {
    const [existing] = await db
      .select({ id: certificationRecords.id })
      .from(certificationRecords)
      .where(
        and(
          eq(certificationRecords.employeeId, employeeId),
          eq(certificationRecords.certificationId, def.id),
          eq(certificationRecords.status, "valid")
        )
      )
      .limit(1);
    if (existing) continue;

    const issuedAt = new Date();
    const expiresAt =
      def.validityMonths > 0
        ? new Date(new Date(issuedAt).setMonth(issuedAt.getMonth() + def.validityMonths))
        : null;

    const [rec] = await db
      .insert(certificationRecords)
      .values({ workspaceId: def.workspaceId, employeeId, certificationId: def.id, issuedAt, expiresAt, status: "valid" })
      .returning();

    await emitEventStandalone({
      workspaceId: def.workspaceId,
      eventType: "certification.issued",
      aggregateType: "certification_record",
      aggregateId: rec.id,
      actorUserId: evt.actorUserId,
      payload: { certificationId: def.id, employeeId, name: def.name },
    });
  }
}

// ── Vendor scoring (blueprint 04 §2) ─────────────────────────────────
// Every goods receipt refreshes the vendor's rolling all-time scorecard.
// Recomputed from source data, so the consumer is idempotent by construction.
async function runVendorScoring(evt: OutboxRow): Promise<void> {
  if (evt.eventType !== "po.received") return;
  if (!evt.workspaceId || !evt.aggregateId) return;

  const [po] = await db
    .select({ vendorId: purchaseOrders.vendorId })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, evt.aggregateId))
    .limit(1);
  if (!po?.vendorId) return;

  // On-time % over every PO of this vendor that has a promised date and at
  // least one receipt: on time when the LAST receipt landed by expectedDate.
  const rows = await db
    .select({
      poId: purchaseOrders.id,
      expectedDate: purchaseOrders.expectedDate,
      lastReceived: sql<string>`max(${goodsReceipts.receivedAt})`,
    })
    .from(purchaseOrders)
    .innerJoin(goodsReceipts, eq(goodsReceipts.purchaseOrderId, purchaseOrders.id))
    .where(eq(purchaseOrders.vendorId, po.vendorId))
    .groupBy(purchaseOrders.id, purchaseOrders.expectedDate);

  const dated = rows.filter((r) => r.expectedDate != null);
  if (dated.length === 0) return; // nothing to score yet

  const onTime = dated.filter((r) => new Date(r.lastReceived) <= r.expectedDate!).length;
  const onTimePct = Math.round((onTime / dated.length) * 1000) / 10;
  const rating = Math.round((onTimePct / 20) * 10) / 10; // 0–5 scale

  const [existing] = await db
    .select({ id: vendorPerformance.id })
    .from(vendorPerformance)
    .where(and(eq(vendorPerformance.vendorId, po.vendorId), isNull(vendorPerformance.periodStart)))
    .limit(1);

  if (existing) {
    await db
      .update(vendorPerformance)
      .set({ onTimePct, rating, note: `Rolling all-time over ${dated.length} dated PO(s).` })
      .where(eq(vendorPerformance.id, existing.id));
  } else {
    await db.insert(vendorPerformance).values({
      workspaceId: evt.workspaceId,
      vendorId: po.vendorId,
      onTimePct,
      rating,
      note: `Rolling all-time over ${dated.length} dated PO(s).`,
    });
  }
}

// ── Replenishment (Plan §1 / blueprint 04 §1) ────────────────────────
// stock.low → draft purchase requisition for the product, so procurement
// has an actionable document, not just a notification. Idempotent: at most
// one open (draft/submitted) auto-requisition line per product.
async function runReplenishment(evt: OutboxRow): Promise<void> {
  if (evt.eventType !== "stock.low") return;
  const productId = evt.aggregateId;
  const workspaceId = evt.workspaceId;
  if (!productId || !workspaceId) return;

  // Already an open requisition carrying this product? Then the retry/repeat
  // low-stock signal adds nothing.
  const [open] = await db
    .select({ id: requisitionLines.id })
    .from(requisitionLines)
    .innerJoin(purchaseRequisitions, eq(purchaseRequisitions.id, requisitionLines.requisitionId))
    .where(
      and(
        eq(purchaseRequisitions.workspaceId, workspaceId),
        inArray(purchaseRequisitions.status, ["draft", "submitted"]),
        eq(requisitionLines.productId, productId)
      )
    )
    .limit(1);
  if (open) return;

  const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!product) return;

  const available = Number(evt.payload?.available ?? 0);
  const reorderLevel = Number(evt.payload?.reorderLevel ?? product.reorderLevel ?? 0);
  const qty = Math.max(reorderLevel - available, 1);

  await db.transaction(async (tx) => {
    const docNumber = await nextDocNumber(tx, { workspaceId, docType: "purchase_requisition" });
    const [req] = await tx
      .insert(purchaseRequisitions)
      .values({
        workspaceId,
        docNumber,
        status: "draft",
        notes: `Auto-draft: ${product.name} fell below its reorder level (available ${available}, reorder at ${reorderLevel}).`,
        requestedBy: evt.actorUserId ?? null,
      })
      .returning();
    await tx.insert(requisitionLines).values({
      requisitionId: req.id,
      productId,
      description: product.name,
      quantity: qty,
      estUnitCostMinor: product.costMinor ?? 0,
    });
  });
}

// ── Safety escalation (blueprint 04 §6) ──────────────────────────────
// High/critical incidents must reach people immediately — targeted pings to
// workspace owners/admins, deduped per event so retries never re-page.
async function runSafetyEscalation(evt: OutboxRow): Promise<void> {
  if (evt.eventType !== "incident.reported") return;
  const severity = (evt.payload?.severity as string) ?? "low";
  if (severity !== "high" && severity !== "critical" || !evt.workspaceId) return;

  // Dedupe on the producing event id.
  const [already] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.type, "incident_escalation"), sql`${notifications.meta}->>'eventId' = ${evt.id}`))
    .limit(1);
  if (already) return;

  const admins = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, evt.workspaceId), inArray(workspaceMembers.role, ["owner", "admin"])));

  for (const a of admins) {
    await notifyUser(
      a.userId,
      "incident_escalation",
      `${severity === "critical" ? "CRITICAL" : "High-severity"} incident reported`,
      `Incident ${String(evt.payload?.number ?? "")} (${String(evt.payload?.type ?? "incident")}) requires immediate attention.`,
      { eventId: evt.id, incidentId: evt.aggregateId, severity }
    );
  }
}

// ── Asset downtime → planning impact (blueprint 04 §4/§5) ────────────
// When an asset goes down or into maintenance, every pending/in-progress
// stage scheduled on a machine backed by that asset gets a blocker conflict,
// so planners see the impact immediately instead of at the next replan.
async function runAssetDowntime(evt: OutboxRow): Promise<void> {
  if (evt.eventType !== "asset.status_changed") return;
  const to = (evt.payload?.to as string) ?? "";
  if ((to !== "down" && to !== "maintenance") || !evt.aggregateId || !evt.workspaceId) return;

  const machines = await db
    .select({ id: workCenterMachines.id })
    .from(workCenterMachines)
    .where(and(eq(workCenterMachines.workspaceId, evt.workspaceId), eq(workCenterMachines.assetId, evt.aggregateId)));
  if (machines.length === 0) return;

  const affected = await db
    .select()
    .from(jobStageSchedules)
    .where(
      and(
        eq(jobStageSchedules.workspaceId, evt.workspaceId),
        inArray(jobStageSchedules.assignedMachineId, machines.map((m) => m.id)),
        inArray(jobStageSchedules.status, ["pending", "in_progress"])
      )
    );

  for (const sched of affected) {
    // One open maintenance_block per work order × stage is enough.
    const [existing] = await db
      .select({ id: planningConflicts.id })
      .from(planningConflicts)
      .where(
        and(
          eq(planningConflicts.workOrderId, sched.workOrderId),
          eq(planningConflicts.conflictType, "maintenance_block"),
          eq(planningConflicts.status, "open"),
          sched.stageId ? eq(planningConflicts.stageId, sched.stageId) : isNull(planningConflicts.stageId)
        )
      )
      .limit(1);
    if (existing) continue;

    await db.insert(planningConflicts).values({
      workspaceId: evt.workspaceId,
      workOrderId: sched.workOrderId,
      stageId: sched.stageId ?? null,
      conflictType: "maintenance_block",
      severity: "blocker",
      description: `Stage "${sched.stageName}" is scheduled on a machine whose asset is ${to}.`,
      suggestedAction: "Reassign the stage to another machine/work center or reschedule after the asset returns to service.",
    });
  }
}

// ── Notifications fan-out ────────────────────────────────────────────
// Unified delivery: write in-app rows and (optionally) email, honouring
// notification_preferences. (Plan D.5.2.) Audience = workspace members for
// now; richer targeting (assignee, QC manager) can refine the payload.
async function runNotifications(evt: OutboxRow): Promise<void> {
  // Only notify on events that carry a human-meaningful change.
  const notify: Record<string, { title: string; body: string }> = {
    "inspection.flagged": {
      title: "Inspection flagged",
      body: "An inspection raised one or more flagged responses and corrective actions were created.",
    },
    "inspection.submitted": {
      title: "Inspection submitted",
      body: "An inspection was submitted.",
    },
    "ncr.raised": { title: "NCR raised", body: "A non-conformance report was raised." },
    "signdoc.completed": { title: "Document signed", body: "A document completed signing." },
    "stock.low": { title: "Low stock", body: "A product dropped below its reorder level." },
    "estimate.accepted": { title: "Estimate accepted", body: "A customer accepted an estimate." },
    "estimate.rejected": { title: "Estimate rejected", body: "A customer rejected an estimate." },
    "invoice.paid": { title: "Invoice paid", body: "An invoice was fully paid." },
    "invoice.overdue": { title: "Invoice overdue", body: "An invoice is past its due date." },
    "certification.expiring": { title: "Certification expiring", body: "A certification is expiring soon." },
  };
  const spec = notify[evt.eventType];
  if (!spec || !evt.workspaceId) return;

  const members = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, evt.workspaceId));

  for (const m of members) {
    const [pref] = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, m.userId),
          eq(notificationPreferences.eventType, evt.eventType)
        )
      )
      .limit(1);

    const inApp = pref?.inApp ?? true;
    const email = pref?.email ?? false; // default email off to avoid noise

    if (inApp) {
      await db.insert(notifications).values({
        userId: m.userId,
        type: evt.eventType.replace(".", "_"),
        title: spec.title,
        body: spec.body,
        meta: { eventId: evt.id, eventType: evt.eventType, aggregateId: evt.aggregateId },
      });
    }

    if (email) {
      const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, m.userId)).limit(1);
      if (u?.email) {
        await sendEmail({ to: u.email, subject: spec.title, html: `<p>${spec.body}</p>` }).catch(() => {});
      }
    }
  }
}

// ── Activity feed projection ─────────────────────────────────────────
// One denormalized timeline row per meaningful event, with full ancestry,
// so the task / board / workspace feeds are each a single indexed read.
const FEED_ACTIONS: Partial<Record<string, { refType: string; action: string; summary: string }>> = {
  "item.created": { refType: "item", action: "item_created", summary: "Item created" },
  "item.status_changed": { refType: "item", action: "status_changed", summary: "Status changed" },
  "inspection.submitted": { refType: "inspection", action: "inspection_submitted", summary: "Inspection submitted" },
  "inspection.flagged": { refType: "inspection", action: "inspection_flagged", summary: "Inspection flagged" },
  "timelog.checked_in": { refType: "time_log", action: "clocked_in", summary: "Clocked in" },
  "timelog.checked_out": { refType: "time_log", action: "clocked_out", summary: "Clocked out" },
  "signdoc.completed": { refType: "sign_document", action: "document_signed", summary: "Document signed" },
  "form.submitted": { refType: "form", action: "form_submitted", summary: "Form submitted" },
  // ── Business-ops (Plan §10) ────────────────────────────────────────
  "vendor.created": { refType: "vendor", action: "vendor_created", summary: "Vendor added" },
  "approval.requested": { refType: "approval_request", action: "approval_requested", summary: "Approval requested" },
  "approval.approved": { refType: "approval_request", action: "approval_approved", summary: "Approval granted" },
  "approval.rejected": { refType: "approval_request", action: "approval_rejected", summary: "Approval rejected" },
  "po.submitted": { refType: "purchase_order", action: "po_submitted", summary: "PO submitted for approval" },
  "po.approved": { refType: "purchase_order", action: "po_approved", summary: "PO approved" },
  "po.rejected": { refType: "purchase_order", action: "po_rejected", summary: "PO rejected" },
  "po.sent": { refType: "purchase_order", action: "po_sent", summary: "PO sent to vendor" },
  "po.received": { refType: "purchase_order", action: "po_received", summary: "Goods received" },
  "stock.received": { refType: "product", action: "stock_received", summary: "Stock received" },
  "stock.adjusted": { refType: "product", action: "stock_adjusted", summary: "Stock adjusted" },
  "stock.low": { refType: "product", action: "stock_low", summary: "Low stock" },
  "estimate.sent": { refType: "estimate", action: "estimate_sent", summary: "Estimate sent" },
  "estimate.accepted": { refType: "estimate", action: "estimate_accepted", summary: "Estimate accepted" },
  "estimate.rejected": { refType: "estimate", action: "estimate_rejected", summary: "Estimate rejected" },
  "estimate.converted": { refType: "estimate", action: "estimate_converted", summary: "Estimate converted" },
  "estimate.expired": { refType: "estimate", action: "estimate_expired", summary: "Estimate expired" },
  "invoice.voided": { refType: "invoice", action: "invoice_voided", summary: "Invoice voided" },
  "salesorder.submitted": { refType: "sales_order", action: "so_submitted", summary: "Sales order submitted for approval" },
  "salesorder.approved": { refType: "sales_order", action: "so_approved", summary: "Sales order approved & reserved" },
  "salesorder.cancelled": { refType: "sales_order", action: "so_cancelled", summary: "Sales order cancelled" },
  "salesorder.invoiced": { refType: "sales_order", action: "so_invoiced", summary: "Sales order invoiced" },
  "shipment.shipped": { refType: "shipment", action: "shipment_shipped", summary: "Shipment dispatched" },
  "shipment.delivered": { refType: "shipment", action: "shipment_delivered", summary: "Shipment delivered" },
  "invoice.created": { refType: "invoice", action: "invoice_created", summary: "Invoice created" },
  "invoice.sent": { refType: "invoice", action: "invoice_sent", summary: "Invoice sent" },
  "invoice.paid": { refType: "invoice", action: "invoice_paid", summary: "Invoice paid" },
  "invoice.overdue": { refType: "invoice", action: "invoice_overdue", summary: "Invoice overdue" },
  "payment.recorded": { refType: "payment", action: "payment_recorded", summary: "Payment recorded" },
  "expense.submitted": { refType: "expense", action: "expense_submitted", summary: "Expense submitted" },
  "expense.approved": { refType: "expense", action: "expense_approved", summary: "Expense approved" },
  "expense.rejected": { refType: "expense", action: "expense_rejected", summary: "Expense rejected" },
  "expense.reimbursed": { refType: "expense", action: "expense_reimbursed", summary: "Expense reimbursed" },
  "leave.requested": { refType: "leave_request", action: "leave_requested", summary: "Leave requested" },
  "leave.approved": { refType: "leave_request", action: "leave_approved", summary: "Leave approved" },
  "leave.rejected": { refType: "leave_request", action: "leave_rejected", summary: "Leave rejected" },
  "course.assigned": { refType: "enrollment", action: "course_assigned", summary: "Course assigned" },
  "course.completed": { refType: "course", action: "course_completed", summary: "Course completed" },
  "certification.issued": { refType: "certification_record", action: "certification_issued", summary: "Certification issued" },
  "certification.expiring": { refType: "certification_record", action: "certification_expiring", summary: "Certification expiring" },
  // ── Masters (Phase 1: silent modules wired) ─────────────────────────
  "product.created": { refType: "product", action: "product_created", summary: "Product created" },
  "product.updated": { refType: "product", action: "product_updated", summary: "Product updated" },
  "product.lifecycle_changed": { refType: "product", action: "product_lifecycle_changed", summary: "Product lifecycle changed" },
  "customer.created": { refType: "customer", action: "customer_created", summary: "Customer added" },
  "customer.updated": { refType: "customer", action: "customer_updated", summary: "Customer updated" },
  // ── Manufacturing / maintenance / safety / requisitions ────────────
  "workorder.released": { refType: "work_order", action: "workorder_released", summary: "Work order released" },
  "workorder.completed": { refType: "work_order", action: "workorder_completed", summary: "Work order completed" },
  "workorder.cancelled": { refType: "work_order", action: "workorder_cancelled", summary: "Work order cancelled" },
  "asset.created": { refType: "asset", action: "asset_created", summary: "Asset registered" },
  "asset.status_changed": { refType: "asset", action: "asset_status_changed", summary: "Asset status changed" },
  "maintenance.scheduled": { refType: "maintenance_order", action: "maintenance_scheduled", summary: "Maintenance order created" },
  "maintenance.started": { refType: "maintenance_order", action: "maintenance_started", summary: "Maintenance started" },
  "maintenance.completed": { refType: "maintenance_order", action: "maintenance_completed", summary: "Maintenance completed" },
  "incident.reported": { refType: "incident", action: "incident_reported", summary: "Incident reported" },
  "incident.closed": { refType: "incident", action: "incident_closed", summary: "Incident closed" },
  "requisition.submitted": { refType: "purchase_requisition", action: "requisition_submitted", summary: "Requisition submitted" },
  "requisition.approved": { refType: "purchase_requisition", action: "requisition_approved", summary: "Requisition approved" },
  "requisition.rejected": { refType: "purchase_requisition", action: "requisition_rejected", summary: "Requisition rejected" },
  "requisition.converted": { refType: "purchase_requisition", action: "requisition_converted", summary: "Requisition converted to PO" },
};

async function runActivityFeed(evt: OutboxRow): Promise<void> {
  const spec = FEED_ACTIONS[evt.eventType];
  if (!spec) return;

  const p = evt.payload ?? {};
  await db
    .insert(activityFeed)
    .values({
      workspaceId: evt.workspaceId ?? null,
      boardId: (p.boardId as string) ?? null,
      groupId: (p.groupId as string) ?? null,
      itemId: (p.itemId as string) ?? null,
      actorUserId: evt.actorUserId ?? null,
      eventId: evt.id,
      refType: spec.refType,
      refId: evt.aggregateId ?? null,
      action: spec.action,
      summary: (p.summary as string) ?? spec.summary,
    })
    // A consumer failing later in the chain re-runs this event; the unique
    // event_id makes the feed projection a no-op on retry.
    .onConflictDoNothing({ target: activityFeed.eventId });
}

/** All consumers, run in order for a single event. */
export async function runConsumers(evt: OutboxRow): Promise<void> {
  await runActivityFeed(evt);
  await runQualityLoop(evt);
  await runLaborRollup(evt);
  await runApprovalRouting(evt);
  await runApprovalSubjectSync(evt);
  await runStockLedger(evt);
  await runVendorScoring(evt);
  await runReplenishment(evt);
  await runSafetyEscalation(evt);
  await runAssetDowntime(evt);
  await runCertificationIssue(evt);
  await runNotifications(evt);
}

// Re-export for callers that want roll-up SQL elsewhere.
export { sql };
