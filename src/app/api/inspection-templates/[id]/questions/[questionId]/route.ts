import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templateQuestions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/inspection-templates/[id]/questions/[questionId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { questionId } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description;
  if (body.type !== undefined) update.type = body.type;
  if (body.required !== undefined) update.required = body.required;
  if (body.scoring !== undefined) update.scoring = body.scoring;
  if (body.weight !== undefined) update.weight = body.weight;
  if (body.options !== undefined) update.options = body.options;
  if (body.position !== undefined) update.position = body.position;
  if (body.sectionId !== undefined) update.sectionId = body.sectionId;
  if (body.conditionalRules !== undefined) update.conditionalRules = body.conditionalRules;
  if (body.flagRules !== undefined) update.flagRules = body.flagRules;
  if (body.linkedQuestionId !== undefined) update.linkedQuestionId = body.linkedQuestionId;
  if (body.instructions !== undefined) update.instructions = body.instructions;

  const [updated] = await db
    .update(templateQuestions)
    .set(update)
    .where(eq(templateQuestions.id, questionId))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/inspection-templates/[id]/questions/[questionId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { questionId } = await params;

  await db.delete(templateQuestions).where(eq(templateQuestions.id, questionId));
  return NextResponse.json({ message: "Deleted" });
}
