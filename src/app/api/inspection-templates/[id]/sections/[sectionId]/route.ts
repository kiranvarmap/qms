import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templateSections } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/inspection-templates/[id]/sections/[sectionId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.position !== undefined) update.position = body.position;
  if (body.pageNumber !== undefined) update.pageNumber = body.pageNumber;
  if (body.isRepeatable !== undefined) update.isRepeatable = body.isRepeatable;
  if (body.maxRepetitions !== undefined) update.maxRepetitions = body.maxRepetitions;
  if (body.requiresSignoff !== undefined) update.requiresSignoff = body.requiresSignoff;
  if (body.signoffRoles !== undefined) update.signoffRoles = body.signoffRoles;

  const [updated] = await db
    .update(templateSections)
    .set(update)
    .where(eq(templateSections.id, sectionId))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/inspection-templates/[id]/sections/[sectionId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await params;

  await db.delete(templateSections).where(eq(templateSections.id, sectionId));
  return NextResponse.json({ message: "Deleted" });
}
