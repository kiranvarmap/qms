import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspectionActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// GET /api/inspections/[id]/actions
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const actions = await db
    .select()
    .from(inspectionActions)
    .where(eq(inspectionActions.inspectionId, id));

  return NextResponse.json(actions);
}

// POST /api/inspections/[id]/actions
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: inspectionId } = await params;
  const { questionId, title, priority, assignedTo, dueDate } = await request.json();

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }

  const [action] = await db
    .insert(inspectionActions)
    .values({
      inspectionId,
      questionId: questionId || null,
      title: title.trim(),
      priority: priority || "medium",
      assignedTo: assignedTo || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();

  return NextResponse.json(action, { status: 201 });
}
