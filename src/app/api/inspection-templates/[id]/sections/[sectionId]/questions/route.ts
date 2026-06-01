import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templateQuestions } from "@/lib/db/schema";

// POST /api/inspection-templates/[id]/sections/[sectionId]/questions
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sectionId } = await params;
  const body = await request.json();

  const [question] = await db
    .insert(templateQuestions)
    .values({
      sectionId,
      type: body.type || "yes_no_na",
      title: body.title || "New question",
      description: body.description ?? null,
      required: body.required ?? false,
      scoring: body.scoring ?? false,
      weight: body.weight ?? 1,
      position: body.position ?? Date.now(),
      options: body.options ?? [],
      conditionalRules: body.conditionalRules ?? null,
      flagRules: body.flagRules ?? null,
      instructions: body.instructions ?? null,
    })
    .returning();

  return NextResponse.json(question, { status: 201 });
}
