import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  inspections,
  inspectionTemplates,
  templateSections,
  templateQuestions,
  inspectionItemLinks,
  items,
  users,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/inspections — list all inspections for current user (all if admin)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select({
      inspection: inspections,
      userName: users.name,
      userEmail: users.email,
    })
    .from(inspections)
    .leftJoin(users, eq(inspections.conductedBy, users.id))
    .orderBy(desc(inspections.createdAt));

  const result = rows.map((r) => ({
    ...r.inspection,
    conductedByName: r.userName || r.userEmail,
  }));

  return NextResponse.json(result);
}

// POST /api/inspections — start a new inspection
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { templateId, title, site, itemId } = await request.json();
  if (!templateId || !title?.trim()) {
    return NextResponse.json({ error: "templateId and title are required" }, { status: 400 });
  }

  // Load template + build snapshot
  const [template] = await db
    .select()
    .from(inspectionTemplates)
    .where(eq(inspectionTemplates.id, templateId));

  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const sections = await db
    .select()
    .from(templateSections)
    .where(eq(templateSections.templateId, templateId))
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

  const snapshot = { sections: sectionsWithQuestions, scoringEnabled: template.scoringEnabled };

  const [inspection] = await db
    .insert(inspections)
    .values({
      templateId,
      templateSnapshot: snapshot,
      title: title.trim(),
      site: site || null,
      workspaceId: template.workspaceId || null,
      conductedBy: session.user.id,
    })
    .returning();

  // Auto-link to board item if provided (item = job/project)
  let linkedItemId: string | null = null;
  let linkedItemName: string | null = null;
  if (itemId) {
    await db.insert(inspectionItemLinks).values({
      inspectionId: inspection.id,
      itemId,
      linkedBy: session.user.id,
    });
    const [item] = await db.select({ name: items.name }).from(items).where(eq(items.id, itemId));
    if (item) {
      linkedItemId = itemId;
      linkedItemName = item.name;
    }
  }

  return NextResponse.json({
    ...inspection,
    responses: [],
    actions: [],
    conductedByName: session.user.name || session.user.email,
    linkedItemId,
    linkedItemName,
  }, { status: 201 });
}
