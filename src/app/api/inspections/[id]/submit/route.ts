import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspections, inspectionResponses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TemplateSection } from "@/lib/types";
import { calculateScore } from "@/lib/scoring";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/inspections/[id]/submit
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [inspection] = await db
    .select()
    .from(inspections)
    .where(eq(inspections.id, id));

  if (!inspection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const responses = await db
    .select()
    .from(inspectionResponses)
    .where(eq(inspectionResponses.inspectionId, id));

  const snapshot = inspection.templateSnapshot as {
    sections: TemplateSection[];
    scoringEnabled: boolean;
    isNcr?: boolean;
  };

  // Calculate score using shared utility
  const score = snapshot.scoringEnabled
    ? calculateScore(snapshot.sections, responses)
    : null;

  const flaggedCount = responses.filter((r) => r.flagged).length;
  const isNcr = Boolean(snapshot.isNcr);

  // ── Write the domain row AND the outbox event in one transaction ─────
  // (Plan D.5 — transactional outbox guarantees no lost events.)
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(inspections)
      .set({
        status: "completed",
        score,
        completedAt: new Date(),
        ncrStatus: isNcr ? "raised" : inspection.ncrStatus,
      })
      .where(eq(inspections.id, id))
      .returning();

    const ancestry = {
      boardId: row.boardId,
      groupId: row.groupId,
      itemId: row.itemId,
      summary: `Inspection "${row.title}" submitted${score !== null ? ` (score ${score})` : ""}`,
    };

    await emitEvent(tx, {
      workspaceId: row.workspaceId,
      eventType: "inspection.submitted",
      aggregateType: "inspection",
      aggregateId: row.id,
      actorUserId: session.user.id,
      payload: { ...ancestry, flaggedCount, score },
    });

    // Flagged responses kick off the Quality Loop (corrective-action task).
    if (flaggedCount > 0) {
      await emitEvent(tx, {
        workspaceId: row.workspaceId,
        eventType: "inspection.flagged",
        aggregateType: "inspection",
        aggregateId: row.id,
        actorUserId: session.user.id,
        payload: { ...ancestry, flaggedCount },
      });
    }

    // NCR templates raise the compliance event.
    if (isNcr) {
      await emitEvent(tx, {
        workspaceId: row.workspaceId,
        eventType: "ncr.raised",
        aggregateType: "inspection",
        aggregateId: row.id,
        actorUserId: session.user.id,
        payload: { ...ancestry, ncrNumber: row.ncrNumber },
      });
    }

    return row;
  });

  // Fire the consumers now; the cron sweep is the durable backstop.
  dispatchInline();

  return NextResponse.json(updated);
}
