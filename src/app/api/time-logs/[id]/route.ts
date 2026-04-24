import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { timeLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/time-logs/[id] — check OUT
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { checkOutPhoto, notes } = body;

  const [existing] = await db
    .select({ checkInAt: timeLogs.checkInAt, status: timeLogs.status })
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

  const [updated] = await db
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

  return NextResponse.json(updated);
}
