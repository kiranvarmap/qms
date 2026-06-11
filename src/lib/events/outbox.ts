/**
 * Transactional outbox writer (Plan D.5).
 *
 * Call `emitEvent` with the SAME executor (`tx`) you used for the domain
 * write, so the event row and the business row commit atomically. If no
 * executor is passed it falls back to the shared `db` (use only when the
 * write doesn't need to be transactional with anything else).
 */

import { db } from "@/lib/db";
import { eventOutbox } from "@/lib/db/schema";
import type { DomainEventInput } from "./types";

/**
 * Minimal structural type for "something that can run an insert" — satisfied
 * by both the shared `db` and a Drizzle transaction handle, without leaking
 * the heavy generic types.
 */
type Executor = Pick<typeof db, "insert">;

export async function emitEvent(
  executor: Executor,
  event: DomainEventInput
): Promise<void> {
  await executor.insert(eventOutbox).values({
    workspaceId: event.workspaceId ?? null,
    eventType: event.eventType,
    aggregateType: event.aggregateType ?? null,
    aggregateId: event.aggregateId ?? null,
    actorUserId: event.actorUserId ?? null,
    payload: event.payload ?? {},
  });
}

/** Convenience for non-transactional producers. */
export function emitEventStandalone(event: DomainEventInput): Promise<void> {
  return emitEvent(db, event);
}
