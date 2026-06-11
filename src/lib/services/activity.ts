/**
 * Activity read model (Plan B.5).
 *
 * Because every artifact carries resolved ancestry and the dispatcher writes
 * one `activity_feed` row per meaningful action, "show me everything for this
 * X" is a single indexed read at ANY level — the 360° payoff.
 */

import { db } from "@/lib/db";
import { activityFeed } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";

export type FeedLevel = "item" | "board" | "workspace";

/** Unified timeline for one task / board / workspace. */
export async function getActivityFeed(level: FeedLevel, id: string, limit = 100) {
  const col =
    level === "item" ? activityFeed.itemId : level === "board" ? activityFeed.boardId : activityFeed.workspaceId;

  return db
    .select()
    .from(activityFeed)
    .where(eq(col, id))
    .orderBy(desc(activityFeed.occurredAt))
    .limit(limit);
}

/** "Everything this person did" — one identity, one query (Plan E.2 Workflow 5). */
export async function getActorFeed(workspaceId: string, actorUserId: string, limit = 100) {
  return db
    .select()
    .from(activityFeed)
    .where(and(eq(activityFeed.workspaceId, workspaceId), eq(activityFeed.actorUserId, actorUserId)))
    .orderBy(desc(activityFeed.occurredAt))
    .limit(limit);
}
