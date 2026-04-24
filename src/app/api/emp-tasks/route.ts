import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { empTasks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/emp-tasks?projectId=
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(empTasks)
    .where(eq(empTasks.projectId, projectId))
    .orderBy(empTasks.position);

  return NextResponse.json(rows);
}

// POST /api/emp-tasks
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { projectId, name, description, estimatedMinutes } = body;
  if (!projectId || !name) {
    return NextResponse.json({ error: "projectId and name are required" }, { status: 400 });
  }

  // Get max position for the project
  const existing = await db
    .select({ position: empTasks.position })
    .from(empTasks)
    .where(eq(empTasks.projectId, projectId))
    .orderBy(desc(empTasks.position))
    .limit(1);

  const position = existing.length > 0 ? existing[0].position + 1 : 0;

  const [row] = await db
    .insert(empTasks)
    .values({
      projectId,
      name,
      description: description || null,
      estimatedMinutes: estimatedMinutes || null,
      position,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}

// PUT /api/emp-tasks — update task
export async function PUT(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, name, description, estimatedMinutes, status } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const [updated] = await db
    .update(empTasks)
    .set({
      name: name ?? undefined,
      description: description ?? null,
      estimatedMinutes: estimatedMinutes ?? null,
      status: status ?? undefined,
    })
    .where(eq(empTasks.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/emp-tasks
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  await db.delete(empTasks).where(eq(empTasks.id, id));
  return NextResponse.json({ success: true });
}
