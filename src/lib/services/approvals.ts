/**
 * Generic approval engine (Plan §2.4 / §13).
 *
 * ONE polymorphic engine for every sign-off flow (leave, PO, expense,
 * invoice-send) — no per-module forks. A request holds an ordered list of
 * approval steps; decisions advance `currentStep` until the last step approves
 * (→ status `approved`) or any step rejects (→ status `rejected`).
 *
 * Integration: creating a request and recording a decision both emit events
 * (`approval.requested` / `approval.approved` / `approval.rejected`) inside the
 * producing transaction, so the dispatcher fans out notifications to the
 * current approver and writes the activity_feed. Module code calls
 * `createApprovalRequest` on submit and `recordApprovalDecision` from the
 * approvals API — it never re-implements routing.
 */

import { db } from "@/lib/db";
import { approvalRequests, approvalSteps, approvalPolicies, employees } from "@/lib/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

type Executor = Pick<typeof db, "insert">;

export type ApprovalSubjectType = "leave_request" | "purchase_order" | "expense" | "invoice" | "vendor" | "sales_order";

export interface ApprovalStepInput {
  approverEmployeeId?: string | null;
  approverRole?: string | null;
}

export interface CreateApprovalInput {
  workspaceId: string;
  subjectType: ApprovalSubjectType;
  subjectId: string;
  requestedBy?: string | null;
  /** Ordered approvers. If empty, the requester's manager is used. */
  steps?: ApprovalStepInput[];
  /** Amount in minor units — used to resolve amount-gated policy steps. */
  amountMinor?: number;
  boardId?: string | null;
  itemId?: string | null;
  policyId?: string | null;
}

/** Resolve the manager employee id for the user who raised the request. */
async function managerOf(requestedByUserId?: string | null): Promise<string | null> {
  if (!requestedByUserId) return null;
  const [emp] = await db
    .select({ managerEmployeeId: employees.managerEmployeeId })
    .from(employees)
    .where(eq(employees.userId, requestedByUserId))
    .limit(1);
  return emp?.managerEmployeeId ?? null;
}

interface PolicyStep {
  approverRole?: string;
  approverEmployeeId?: string;
  minAmountMinor?: number;
}

/**
 * Build concrete steps from an admin policy for (workspace × subjectType),
 * filtered by amount. Falls back to a single manager step when no policy
 * matches. Returned steps are already ordered.
 */
export async function resolveSteps(input: CreateApprovalInput): Promise<ApprovalStepInput[]> {
  if (input.steps && input.steps.length > 0) return input.steps;

  const [policy] = await db
    .select()
    .from(approvalPolicies)
    .where(
      and(
        eq(approvalPolicies.workspaceId, input.workspaceId),
        eq(approvalPolicies.subjectType, input.subjectType),
        eq(approvalPolicies.isActive, true)
      )
    )
    .limit(1);

  if (policy) {
    const amount = input.amountMinor ?? 0;
    const steps = (policy.steps as PolicyStep[])
      .filter((s) => amount >= (s.minAmountMinor ?? 0))
      .map((s) => ({ approverEmployeeId: s.approverEmployeeId ?? null, approverRole: s.approverRole ?? null }));
    if (steps.length > 0) return steps;
  }

  // Default: route to the requester's manager.
  const managerId = await managerOf(input.requestedBy);
  return [{ approverEmployeeId: managerId, approverRole: managerId ? null : "manager" }];
}

/**
 * Create an approval request with its ordered steps and emit
 * `approval.requested`. Call with the SAME `executor` as the subject write so
 * the request commits atomically with the thing it approves.
 */
export async function createApprovalRequest(
  executor: Executor,
  input: CreateApprovalInput
): Promise<{ requestId: string }> {
  const steps = await resolveSteps(input);

  const [req] = await executor
    .insert(approvalRequests)
    .values({
      workspaceId: input.workspaceId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      requestedBy: input.requestedBy ?? null,
      currentStep: 1,
      policyId: input.policyId ?? null,
      boardId: input.boardId ?? null,
      itemId: input.itemId ?? null,
    })
    .returning();

  // SLA clock starts at request creation for every step (v1 approximation —
  // policy-driven per-step SLAs land with the policy engine).
  const dueAt = new Date(Date.now() + 48 * 3_600_000);
  await executor.insert(approvalSteps).values(
    steps.map((s, i) => ({
      requestId: req.id,
      stepNumber: i + 1,
      approverEmployeeId: s.approverEmployeeId ?? null,
      approverRole: s.approverRole ?? null,
      dueAt,
    }))
  );

  await emitEvent(executor, {
    workspaceId: input.workspaceId,
    eventType: "approval.requested",
    aggregateType: "approval_request",
    aggregateId: req.id,
    actorUserId: input.requestedBy ?? null,
    payload: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      currentStep: 1,
      approverEmployeeId: steps[0]?.approverEmployeeId ?? null,
      approverRole: steps[0]?.approverRole ?? null,
      boardId: input.boardId ?? null,
      itemId: input.itemId ?? null,
    },
  });

  return { requestId: req.id };
}

export interface DecisionInput {
  requestId: string;
  decision: "approved" | "rejected";
  decidedBy: string;
  comment?: string | null;
}

export interface DecisionResult {
  status: "pending" | "approved" | "rejected";
  currentStep: number;
}

/**
 * Record a decision on the request's current step. Approving the last step
 * resolves the request as approved; any rejection resolves it as rejected.
 * Idempotent-safe: a decision on a non-pending request is rejected with an
 * error rather than double-applied.
 */
export async function recordApprovalDecision(input: DecisionInput): Promise<DecisionResult> {
  const result = await db.transaction(async (tx) => {
    const [req] = await tx
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, input.requestId))
      .limit(1);
    if (!req) throw new Error("Approval request not found");
    if (req.status !== "pending") throw new Error("Approval request is already resolved");

    const stepRows = await tx
      .select()
      .from(approvalSteps)
      .where(eq(approvalSteps.requestId, req.id))
      .orderBy(asc(approvalSteps.stepNumber));

    const current = stepRows.find((s) => s.stepNumber === req.currentStep);
    if (!current) throw new Error("No pending step to decide");

    await tx
      .update(approvalSteps)
      .set({
        decision: input.decision,
        decidedBy: input.decidedBy,
        decidedAt: new Date(),
        comment: input.comment ?? null,
      })
      .where(eq(approvalSteps.id, current.id));

    if (input.decision === "rejected") {
      await tx
        .update(approvalRequests)
        .set({ status: "rejected", resolvedAt: new Date() })
        .where(eq(approvalRequests.id, req.id));
      await emitEvent(tx, {
        workspaceId: req.workspaceId,
        eventType: "approval.rejected",
        aggregateType: "approval_request",
        aggregateId: req.id,
        actorUserId: input.decidedBy,
        payload: { subjectType: req.subjectType, subjectId: req.subjectId, boardId: req.boardId, itemId: req.itemId },
      });
      return { status: "rejected" as const, currentStep: req.currentStep };
    }

    // Approved this step — advance or finalize.
    const nextStep = stepRows.find((s) => s.stepNumber === req.currentStep + 1);
    if (nextStep) {
      await tx
        .update(approvalRequests)
        .set({ currentStep: nextStep.stepNumber })
        .where(eq(approvalRequests.id, req.id));
      await emitEvent(tx, {
        workspaceId: req.workspaceId,
        eventType: "approval.requested",
        aggregateType: "approval_request",
        aggregateId: req.id,
        actorUserId: input.decidedBy,
        payload: {
          subjectType: req.subjectType,
          subjectId: req.subjectId,
          currentStep: nextStep.stepNumber,
          approverEmployeeId: nextStep.approverEmployeeId,
          approverRole: nextStep.approverRole,
          boardId: req.boardId,
          itemId: req.itemId,
        },
      });
      return { status: "pending" as const, currentStep: nextStep.stepNumber };
    }

    await tx
      .update(approvalRequests)
      .set({ status: "approved", resolvedAt: new Date() })
      .where(eq(approvalRequests.id, req.id));
    await emitEvent(tx, {
      workspaceId: req.workspaceId,
      eventType: "approval.approved",
      aggregateType: "approval_request",
      aggregateId: req.id,
      actorUserId: input.decidedBy,
      payload: { subjectType: req.subjectType, subjectId: req.subjectId, boardId: req.boardId, itemId: req.itemId },
    });
    return { status: "approved" as const, currentStep: req.currentStep };
  });

  dispatchInline();
  return result;
}

/** Cancel a pending request (e.g. the subject was withdrawn). */
export async function cancelApprovalRequest(requestId: string, actorUserId?: string | null): Promise<void> {
  await db.transaction(async (tx) => {
    const [req] = await tx.select().from(approvalRequests).where(eq(approvalRequests.id, requestId)).limit(1);
    if (!req || req.status !== "pending") return;
    await tx
      .update(approvalRequests)
      .set({ status: "cancelled", resolvedAt: new Date() })
      .where(eq(approvalRequests.id, requestId));
    await emitEvent(tx, {
      workspaceId: req.workspaceId,
      eventType: "approval.rejected",
      aggregateType: "approval_request",
      aggregateId: req.id,
      actorUserId: actorUserId ?? null,
      payload: { subjectType: req.subjectType, subjectId: req.subjectId, cancelled: true },
    });
  });
  dispatchInline();
}
