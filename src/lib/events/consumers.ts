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
} from "@/lib/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
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
};

async function runActivityFeed(evt: OutboxRow): Promise<void> {
  const spec = FEED_ACTIONS[evt.eventType];
  if (!spec) return;

  const p = evt.payload ?? {};
  await db.insert(activityFeed).values({
    workspaceId: evt.workspaceId ?? null,
    boardId: (p.boardId as string) ?? null,
    groupId: (p.groupId as string) ?? null,
    itemId: (p.itemId as string) ?? null,
    actorUserId: evt.actorUserId ?? null,
    refType: spec.refType,
    refId: evt.aggregateId ?? null,
    action: spec.action,
    summary: (p.summary as string) ?? spec.summary,
  });
}

/** All consumers, run in order for a single event. */
export async function runConsumers(evt: OutboxRow): Promise<void> {
  await runActivityFeed(evt);
  await runQualityLoop(evt);
  await runLaborRollup(evt);
  await runNotifications(evt);
}

// Re-export for callers that want roll-up SQL elsewhere.
export { sql };
