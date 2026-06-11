/**
 * Outbox dispatcher (Plan C.3 / E.3).
 *
 * Drains pending `event_outbox` rows and runs the consumers for each. Invoked
 * two ways:
 *   1. Inline, fire-and-forget, right after a producer commits (low latency).
 *   2. By a secured cron route (/api/events/process) as the durable safety net
 *      that retries anything the inline path missed or that failed.
 *
 * On Vercel's serverless model an in-process long-running worker won't survive,
 * so the cron sweep is the source of truth; inline dispatch is just an
 * optimisation. A row is retried up to MAX_ATTEMPTS, then parked as `dead`.
 */

import { db } from "@/lib/db";
import { eventOutbox } from "@/lib/db/schema";
import { and, asc, eq, lt, sql } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { runConsumers } from "./consumers";
import type { OutboxRow } from "./types";

const MAX_ATTEMPTS = 5;

function toRow(r: typeof eventOutbox.$inferSelect): OutboxRow {
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    eventType: r.eventType,
    aggregateType: r.aggregateType,
    aggregateId: r.aggregateId,
    payload: (r.payload as Record<string, unknown>) ?? {},
    actorUserId: r.actorUserId,
    occurredAt: r.occurredAt,
    attempts: r.attempts,
  };
}

/** Process up to `limit` pending events. Returns counts for observability. */
export async function dispatchPending(limit = 50): Promise<{ processed: number; failed: number }> {
  const pending = await db
    .select()
    .from(eventOutbox)
    .where(and(eq(eventOutbox.status, "pending"), lt(eventOutbox.attempts, MAX_ATTEMPTS)))
    .orderBy(asc(eventOutbox.occurredAt))
    .limit(limit);

  let processed = 0;
  let failed = 0;

  for (const raw of pending) {
    // Claim the row so concurrent sweeps don't double-process it.
    const claimed = await db
      .update(eventOutbox)
      .set({ status: "processing" })
      .where(and(eq(eventOutbox.id, raw.id), eq(eventOutbox.status, "pending")))
      .returning({ id: eventOutbox.id });
    if (claimed.length === 0) continue; // someone else took it

    try {
      await runConsumers(toRow(raw));
      await db
        .update(eventOutbox)
        .set({ status: "done", processedAt: new Date() })
        .where(eq(eventOutbox.id, raw.id));
      processed++;
    } catch (err) {
      const attempts = raw.attempts + 1;
      const dead = attempts >= MAX_ATTEMPTS;
      await db
        .update(eventOutbox)
        .set({
          status: dead ? "dead" : "pending",
          attempts,
          lastError: err instanceof Error ? err.message : String(err),
        })
        .where(eq(eventOutbox.id, raw.id));
      failed++;
      logger.error("event dispatch failed", {
        eventId: raw.id,
        eventType: raw.eventType,
        attempts,
        dead,
      });
    }
  }

  return { processed, failed };
}

/**
 * Fire-and-forget inline dispatch. Never throws into the request path — the
 * cron sweep is the durable backstop. Call after the producing txn commits.
 */
export function dispatchInline(): void {
  dispatchPending(20).catch((err) => {
    logger.warn("inline dispatch error (cron will retry)", {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

export { sql };
