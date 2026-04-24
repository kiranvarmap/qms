import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspectionResponses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// PUT /api/inspections/[id]/responses  — upsert a response
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: inspectionId } = await params;
  const body = await request.json();
  const { questionId, sectionId, value, flagged, note, repeatIndex = 0 } = body;

  if (!questionId || !sectionId) {
    return NextResponse.json({ error: "questionId and sectionId required" }, { status: 400 });
  }

  // Check if response exists (must match both questionId AND repeatIndex for repeatable sections)
  const [existing] = await db
    .select()
    .from(inspectionResponses)
    .where(
      and(
        eq(inspectionResponses.inspectionId, inspectionId),
        eq(inspectionResponses.questionId, questionId),
        eq(inspectionResponses.repeatIndex, repeatIndex)
      )
    );

  let result;
  if (existing) {
    const update: Record<string, unknown> = { updatedAt: new Date() };
    if (value !== undefined) update.value = value;
    if (flagged !== undefined) update.flagged = flagged;
    if (note !== undefined) update.note = note;
    [result] = await db
      .update(inspectionResponses)
      .set(update)
      .where(eq(inspectionResponses.id, existing.id))
      .returning();
  } else {
    [result] = await db
      .insert(inspectionResponses)
      .values({
        inspectionId,
        questionId,
        sectionId,
        repeatIndex,
        value: value ?? null,
        flagged: flagged ?? false,
        note: note ?? null,
      })
      .returning();
  }

  return NextResponse.json(result);
}
