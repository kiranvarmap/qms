import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { timeLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/time-logs/[id] — check OUT
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { checkOutPhoto, notes } = body;

  const [existing] = await db
    .select()
    .from(timeLogs)
    .where(eq(timeLogs.id, id));

  if (!existing) return NextResponse.json({ error: "Log not found" }, { status: 404 });
  if (existing.status !== "active") {
    return NextResponse.json({ error: "Log already completed" }, { status: 409 });
  }

  const checkOutAt = new Date();
  const durationMinutes = Math.round(
    (checkOutAt.getTime() - new Date(existing.checkInAt).getTime()) / 60000
  );

  // Domain write + outbox event in one transaction (Labor Loop, Plan E.2 #4).
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(timeLogs)
      .set({
        checkOutAt,
        checkOutPhoto: checkOutPhoto || null,
        durationMinutes,
        notes: notes || null,
        status: "completed",
      })
      .where(eq(timeLogs.id, id))
      .returning();

    await emitEvent(tx, {
      workspaceId: row.workspaceId,
      eventType: "timelog.checked_out",
      aggregateType: "time_log",
      aggregateId: row.id,
      payload: {
        boardId: row.boardId,
        groupId: row.groupId,
        itemId: row.itemId,
        durationMinutes,
        summary: `Clocked out (${durationMinutes} min)`,
      },
    });

    return row;
  });

  dispatchInline();

  return NextResponse.json(updated);
}
