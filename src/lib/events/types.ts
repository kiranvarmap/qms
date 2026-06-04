/**
 * Event backbone — the typed catalogue of domain events (Plan C.3 / D.5).
 *
 * Every cross-module side effect flows through these events rather than
 * direct service-to-service calls. Producers write an `event_outbox` row in
 * the same transaction as their domain write; the dispatcher fans them out
 * to consumers (automations, notifications, corrective-action creation,
 * roll-ups) and to the unified `activity_feed`.
 */

export type EventType =
  // ── Core (existing) ────────────────────────────────────────────────
  | "item.created"
  | "item.updated"
  | "item.status_changed"
  | "item.moved"
  | "inspection.submitted"
  | "inspection.flagged"
  | "inspection.signed"
  | "inspection.remediated"
  | "ncr.raised"
  | "form.submitted"
  | "timelog.checked_in"
  | "timelog.checked_out"
  | "signdoc.sent"
  | "signdoc.completed"
  | "signdoc.declined"
  | "automation.executed"
  // ── Business-ops catalogue (Plan §10) ──────────────────────────────
  | "vendor.created"
  | "po.submitted"
  | "po.approved"
  | "po.rejected"
  | "po.sent"
  | "po.received"
  | "stock.received"
  | "stock.reserved"
  | "stock.reservation_released"
  | "stock.shipped"
  | "stock.adjusted"
  | "stock.low"
  | "estimate.sent"
  | "estimate.viewed"
  | "estimate.accepted"
  | "estimate.rejected"
  | "estimate.expired"
  | "estimate.converted"
  | "salesorder.approved"
  | "salesorder.cancelled"
  | "salesorder.invoiced"
  | "shipment.picked"
  | "shipment.packed"
  | "shipment.shipped"
  | "shipment.delivered"
  | "invoice.created"
  | "invoice.sent"
  | "invoice.paid"
  | "invoice.overdue"
  | "payment.recorded"
  | "expense.submitted"
  | "expense.approved"
  | "expense.rejected"
  | "expense.reimbursed"
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "leave.requested"
  | "leave.approved"
  | "leave.rejected"
  | "portal.comment_added"
  | "course.assigned"
  | "course.completed"
  | "certification.issued"
  | "certification.expiring";

export type AggregateType =
  // ── Core (existing) ────────────────────────────────────────────────
  | "item"
  | "inspection"
  | "sign_document"
  | "time_log"
  | "form"
  | "comment"
  // ── Business-ops (Plan §10) ────────────────────────────────────────
  | "vendor"
  | "customer"
  | "product"
  | "purchase_order"
  | "goods_receipt"
  | "estimate"
  | "sales_order"
  | "shipment"
  | "invoice"
  | "payment"
  | "expense"
  | "approval_request"
  | "leave_request"
  | "portal_contact"
  | "course"
  | "enrollment"
  | "certification_record";

/** The shape a producer hands to `emitEvent()`. */
export interface DomainEventInput {
  workspaceId?: string | null;
  eventType: EventType;
  aggregateType?: AggregateType;
  aggregateId?: string | null;
  actorUserId?: string | null;
  /** Free-form, event-specific. Consumers read what they need. */
  payload?: Record<string, unknown>;
}

/** A persisted outbox row, as read back by the dispatcher. */
export interface OutboxRow {
  id: string;
  workspaceId: string | null;
  eventType: string;
  aggregateType: string | null;
  aggregateId: string | null;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  occurredAt: Date;
  attempts: number;
}
