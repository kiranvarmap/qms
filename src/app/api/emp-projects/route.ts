import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { empProjects, empTasks, workshops } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/emp-projects?workshopId=
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const workshopId = searchParams.get("workshopId");
  const withTasks = searchParams.get("withTasks") === "true";

  const rows = await db
    .select({
      id: empProjects.id,
      name: empProjects.name,
      description: empProjects.description,
      workshopId: empProjects.workshopId,
      workshopName: workshops.name,
      status: empProjects.status,
      startDate: empProjects.startDate,
      endDate: empProjects.endDate,
      createdAt: empProjects.createdAt,
      updatedAt: empProjects.updatedAt,
    })
    .from(empProjects)
    .leftJoin(workshops, eq(workshops.id, empProjects.workshopId))
    .where(workshopId ? eq(empProjects.workshopId, workshopId) : undefined)
    .orderBy(desc(empProjects.createdAt));

  if (!withTasks) return NextResponse.json(rows);

  // Attach tasks
  const projectIds = rows.map((r) => r.id);
  if (projectIds.length === 0) return NextResponse.json([]);

  const allTasks = await db
    .select()
    .from(empTasks)
    .orderBy(empTasks.position);

  const tasksByProject: Record<string, typeof allTasks> = {};
  for (const t of allTasks) {
    if (!tasksByProject[t.projectId]) tasksByProject[t.projectId] = [];
    tasksByProject[t.projectId].push(t);
  }

  return NextResponse.json(
    rows.map((p) => ({ ...p, tasks: tasksByProject[p.id] ?? [] }))
  );
}

// POST /api/emp-projects
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, description, workshopId, status, startDate, endDate } = body;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const [row] = await db
    .insert(empProjects)
    .values({
      name,
      description: description || null,
      workshopId: workshopId || null,
      status: status || "active",
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}

// PUT /api/emp-projects — update project
export async function PUT(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, name, description, workshopId, status, startDate, endDate } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const [updated] = await db
    .update(empProjects)
    .set({
      name,
      description: description ?? null,
      workshopId: workshopId ?? null,
      status,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      updatedAt: new Date(),
    })
    .where(eq(empProjects.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/emp-projects
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();
  await db.delete(empProjects).where(eq(empProjects.id, id));
  return NextResponse.json({ success: true });
}
