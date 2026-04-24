import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  timeLogItemLinks,
  timeLogs,
  employees,
  empProjects,
  empTasks,
  items,
} from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/items/[id]/timelogs — list time logs linked to this board item
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: itemId } = await params;

  const rows = await db
    .select({
      timeLogId: timeLogs.id,
      employeeName: employees.name,
      employeeCode: employees.employeeId,
      projectName: empProjects.name,
      taskName: empTasks.name,
      checkInAt: timeLogs.checkInAt,
      checkOutAt: timeLogs.checkOutAt,
      durationMinutes: timeLogs.durationMinutes,
      notes: timeLogs.notes,
      status: timeLogs.status,
      linkedAt: timeLogItemLinks.linkedAt,
    })
    .from(timeLogItemLinks)
    .innerJoin(timeLogs, eq(timeLogs.id, timeLogItemLinks.timeLogId))
    .innerJoin(employees, eq(employees.id, timeLogs.employeeId))
    .leftJoin(empProjects, eq(empProjects.id, timeLogs.projectId))
    .leftJoin(empTasks, eq(empTasks.id, timeLogs.taskId))
    .where(eq(timeLogItemLinks.itemId, itemId))
    .orderBy(desc(timeLogs.checkInAt));

  return NextResponse.json(rows);
}

// POST /api/items/[id]/timelogs — link a time log to this board item
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: itemId } = await params;
  const { timeLogId } = await req.json();

  if (!timeLogId) {
    return NextResponse.json({ error: "timeLogId is required" }, { status: 400 });
  }

  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  const [log] = await db.select().from(timeLogs).where(eq(timeLogs.id, timeLogId)).limit(1);
  if (!log) return NextResponse.json({ error: "Time log not found" }, { status: 404 });

  const [existing] = await db
    .select()
    .from(timeLogItemLinks)
    .where(and(eq(timeLogItemLinks.itemId, itemId), eq(timeLogItemLinks.timeLogId, timeLogId)))
    .limit(1);

  if (existing) return NextResponse.json(existing);

  const [link] = await db
    .insert(timeLogItemLinks)
    .values({ itemId, timeLogId })
    .returning();

  return NextResponse.json(link, { status: 201 });
}

// DELETE /api/items/[id]/timelogs?timeLogId=...
export async function DELETE(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: itemId } = await params;
  const { searchParams } = new URL(req.url);
  const timeLogId = searchParams.get("timeLogId");

  if (!timeLogId) return NextResponse.json({ error: "timeLogId query param required" }, { status: 400 });

  await db
    .delete(timeLogItemLinks)
    .where(and(eq(timeLogItemLinks.itemId, itemId), eq(timeLogItemLinks.timeLogId, timeLogId)));

  return NextResponse.json({ ok: true });
}
