import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspectionTemplates, templateSections, templateQuestions, boards } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/inspection-templates — list all templates
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await db
    .select({
      template: inspectionTemplates,
      boardName: boards.name,
    })
    .from(inspectionTemplates)
    .leftJoin(boards, eq(inspectionTemplates.boardId, boards.id))
    .orderBy(desc(inspectionTemplates.createdAt));

  // Attach sections + questions
  const result = await Promise.all(
    templates.map(async ({ template: t, boardName }) => {
      const sections = await db
        .select()
        .from(templateSections)
        .where(eq(templateSections.templateId, t.id))
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

      return { ...t, boardName, sections: sectionsWithQuestions };
    })
  );

  return NextResponse.json(result);
}

// POST /api/inspection-templates — create a new template
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, description, boardId, workspaceId } = await request.json();
  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const [template] = await db
    .insert(inspectionTemplates)
    .values({
      title: title.trim(),
      description: description || null,
      boardId: boardId || null,
      workspaceId: workspaceId || null,
      createdBy: session.user.id,
    })
    .returning();

  // Create a default first section
  const [section] = await db
    .insert(templateSections)
    .values({ templateId: template.id, title: "General", position: 1 })
    .returning();

  // Fetch board name if linked
  let boardName: string | null = null;
  if (template.boardId) {
    const [b] = await db.select({ name: boards.name }).from(boards).where(eq(boards.id, template.boardId));
    if (b) boardName = b.name;
  }

  return NextResponse.json({ ...template, boardName, sections: [{ ...section, questions: [] }] }, { status: 201 });
}
