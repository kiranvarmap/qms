import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspectionTemplates, templateSections, templateQuestions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

async function getFullTemplate(id: string) {
  const [template] = await db
    .select()
    .from(inspectionTemplates)
    .where(eq(inspectionTemplates.id, id));

  if (!template) return null;

  const sections = await db
    .select()
    .from(templateSections)
    .where(eq(templateSections.templateId, id))
    .orderBy(templateSections.position);

  const sectionsWithQuestions = await Promise.all(
    sections.map(async (s) => {
      const questions = await db
        .select()
        .from(templateQuestions)
        .where(eq(templateQuestions.sectionId, s.id))
        .orderBy(templateQuestions.position);
      return { ...s, questions };
    })
  );

  return { ...template, sections: sectionsWithQuestions };
}

// GET /api/inspection-templates/[id]
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const template = await getFullTemplate(id);
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

// PATCH /api/inspection-templates/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description;
  if (body.isPublished !== undefined) update.isPublished = body.isPublished;
  if (body.scoringEnabled !== undefined) update.scoringEnabled = body.scoringEnabled;
  if (body.boardId !== undefined) update.boardId = body.boardId || null;
  if (body.workspaceId !== undefined) update.workspaceId = body.workspaceId || null;
  if (body.isNcr !== undefined) update.isNcr = body.isNcr;
  if (body.ncrDocNumberFormat !== undefined) update.ncrDocNumberFormat = body.ncrDocNumberFormat || null;
  if (body.pdfTemplateId !== undefined) update.pdfTemplateId = body.pdfTemplateId || null;

  await db.update(inspectionTemplates).set(update).where(eq(inspectionTemplates.id, id));

  const template = await getFullTemplate(id);
  return NextResponse.json(template);
}

// DELETE /api/inspection-templates/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(inspectionTemplates).where(eq(inspectionTemplates.id, id));
  return NextResponse.json({ message: "Deleted" });
}
