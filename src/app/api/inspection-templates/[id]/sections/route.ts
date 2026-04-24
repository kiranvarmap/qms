import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templateSections } from "@/lib/db/schema";

// POST /api/inspection-templates/[id]/sections
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: templateId } = await params;
  const body = await request.json();

  const [section] = await db
    .insert(templateSections)
    .values({
      templateId,
      title: body.title || "New Section",
      position: body.position ?? Date.now(),
      pageNumber: body.pageNumber ?? 1,
    })
    .returning();

  return NextResponse.json({ ...section, questions: [] }, { status: 201 });
}
