/**
 * Safety / EHS service (BRD 13).
 *
 * Incident & near-miss reporting with corrective actions — mirrors the quality
 * CAPA "action → closure" pattern. Lifecycle events flow through the
 * transactional outbox. See docs/brd/00-platform-interoperability.md.
 */

import { db } from "@/lib/db";
import { incidents, safetyActions } from "@/lib/db/schema";
import { and, asc, desc, eq } from "drizzle-orm";
import { emitEvent } from "@/lib/events/outbox";
import { nextDocNumber } from "@/lib/services/document-sequence";

export interface IncidentInput {
  type?: "injury" | "near_miss" | "property" | "environmental";
  severity?: "low" | "medium" | "high" | "critical";
  occurredAt?: string;
  location?: string;
  description?: string;
  assetId?: string;
}

export function listIncidents(workspaceId: string) {
  return db.select().from(incidents).where(eq(incidents.workspaceId, workspaceId)).orderBy(desc(incidents.createdAt));
}

export async function getIncident(workspaceId: string, id: string) {
  const [inc] = await db.select().from(incidents).where(and(eq(incidents.id, id), eq(incidents.workspaceId, workspaceId))).limit(1);
  if (!inc) return null;
  const actions = await db.select().from(safetyActions).where(eq(safetyActions.incidentId, id)).orderBy(asc(safetyActions.createdAt));
  return { incident: inc, actions };
}

export async function createIncident(workspaceId: string, input: IncidentInput, userId: string) {
  return db.transaction(async (tx) => {
    const number = await nextDocNumber(tx, { workspaceId, docType: "incident" });
    const [inc] = await tx
      .insert(incidents)
      .values({
        workspaceId,
        number,
        type: input.type ?? "near_miss",
        severity: input.severity ?? "low",
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
        location: input.location || null,
        description: input.description || null,
        assetId: input.assetId || null,
        reportedBy: userId,
      })
      .returning();
    await emitEvent(tx, {
      workspaceId,
      eventType: "incident.reported",
      aggregateType: "incident",
      aggregateId: inc.id,
      actorUserId: userId,
      payload: { number: inc.number, type: inc.type, severity: inc.severity, assetId: inc.assetId },
    });
    return inc;
  });
}

export async function startInvestigation(workspaceId: string, id: string, rootCause: string | undefined, userId: string) {
  return db.transaction(async (tx) => {
    const [inc] = await tx
      .update(incidents)
      .set({ status: "investigating", investigatorId: userId, rootCause: rootCause || null, updatedAt: new Date() })
      .where(and(eq(incidents.id, id), eq(incidents.workspaceId, workspaceId)))
      .returning();
    if (!inc) return null;
    await emitEvent(tx, {
      workspaceId,
      eventType: "incident.investigation_started",
      aggregateType: "incident",
      aggregateId: id,
      actorUserId: userId,
      payload: { number: inc.number },
    });
    return inc;
  });
}

export async function addAction(workspaceId: string, incidentId: string, description: string, dueDate: string | undefined) {
  const [action] = await db
    .insert(safetyActions)
    .values({
      workspaceId,
      incidentId,
      description,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();
  // Opening an action moves the incident into "actions_open" if still earlier.
  await db
    .update(incidents)
    .set({ status: "actions_open", updatedAt: new Date() })
    .where(and(eq(incidents.id, incidentId), eq(incidents.workspaceId, workspaceId)));
  return action;
}

export async function setActionStatus(workspaceId: string, actionId: string, status: "open" | "done") {
  const [action] = await db
    .update(safetyActions)
    .set({ status, completedAt: status === "done" ? new Date() : null })
    .where(and(eq(safetyActions.id, actionId), eq(safetyActions.workspaceId, workspaceId)))
    .returning();
  return action ?? null;
}

export async function closeIncident(workspaceId: string, id: string, userId: string) {
  return db.transaction(async (tx) => {
    const [inc] = await tx
      .update(incidents)
      .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(incidents.id, id), eq(incidents.workspaceId, workspaceId)))
      .returning();
    if (!inc) return null;
    await emitEvent(tx, {
      workspaceId,
      eventType: "incident.closed",
      aggregateType: "incident",
      aggregateId: id,
      actorUserId: userId,
      payload: { number: inc.number },
    });
    return inc;
  });
}
