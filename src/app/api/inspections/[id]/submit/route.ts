import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspections, inspectionResponses } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { TemplateSection } from "@/lib/types";
import { calculateScore } from "@/lib/scoring";

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
  };

  // Calculate score using shared utility
  const score = snapshot.scoringEnabled
    ? calculateScore(snapshot.sections, responses)
    : null;

  const [updated] = await db
    .update(inspections)
    .set({
      status: "completed",
      score,
      completedAt: new Date(),
    })
    .where(eq(inspections.id, id))
    .returning();

  return NextResponse.json(updated);
}
