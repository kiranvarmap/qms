import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeLogs, employees, workshops, empProjects, empTasks } from "@/lib/db/schema";
import { eq, desc, and, gte, lte } from "drizzle-orm";

const logSelect = {
  id: timeLogs.id,
  employeeId: timeLogs.employeeId,
  employeeName: employees.name,
  employeeCode: employees.employeeId,
  workshopId: timeLogs.workshopId,
  workshopName: workshops.name,
  projectId: timeLogs.projectId,
  projectName: empProjects.name,
  taskId: timeLogs.taskId,
  taskName: empTasks.name,
  checkInAt: timeLogs.checkInAt,
  checkInPhoto: timeLogs.checkInPhoto,
  checkOutAt: timeLogs.checkOutAt,
  checkOutPhoto: timeLogs.checkOutPhoto,
  durationMinutes: timeLogs.durationMinutes,
  notes: timeLogs.notes,
  status: timeLogs.status,
  createdAt: timeLogs.createdAt,
};

// GET /api/time-logs?employeeId=&projectId=&workshopId=&from=&to=&status=
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const projectId = searchParams.get("projectId");
  const workshopId = searchParams.get("workshopId");
  const taskId = searchParams.get("taskId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");

  const conditions = [];
  if (employeeId) conditions.push(eq(timeLogs.employeeId, employeeId));
  if (projectId) conditions.push(eq(timeLogs.projectId, projectId));
  if (workshopId) conditions.push(eq(timeLogs.workshopId, workshopId));
  if (taskId) conditions.push(eq(timeLogs.taskId, taskId));
  if (from) conditions.push(gte(timeLogs.checkInAt, new Date(from)));
  if (to) conditions.push(lte(timeLogs.checkInAt, new Date(to)));
  if (status) conditions.push(eq(timeLogs.status, status as "active" | "completed"));

  const rows = await db
    .select(logSelect)
    .from(timeLogs)
    .leftJoin(employees, eq(employees.id, timeLogs.employeeId))
    .leftJoin(workshops, eq(workshops.id, timeLogs.workshopId))
    .leftJoin(empProjects, eq(empProjects.id, timeLogs.projectId))
    .leftJoin(empTasks, eq(empTasks.id, timeLogs.taskId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(timeLogs.checkInAt))
    .limit(500);

  return NextResponse.json(rows);
}

// POST /api/time-logs — check IN
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { employeeId, workshopId, projectId, taskId, checkInPhoto } = body;

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  // Verify employee exists
  const [emp] = await db
    .select({ id: employees.id, name: employees.name })
    .from(employees)
    .where(eq(employees.id, employeeId));

  if (!emp) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  // Check no active log
  const [activeLog] = await db
    .select({ id: timeLogs.id })
    .from(timeLogs)
    .where(and(eq(timeLogs.employeeId, employeeId), eq(timeLogs.status, "active")));

  if (activeLog) {
    return NextResponse.json({ error: "Employee already checked in" }, { status: 409 });
  }

  const [log] = await db
    .insert(timeLogs)
    .values({
      employeeId,
      workshopId: workshopId || null,
      projectId: projectId || null,
      taskId: taskId || null,
      checkInAt: new Date(),
      checkInPhoto: checkInPhoto || null,
      status: "active",
    })
    .returning();

  return NextResponse.json(log, { status: 201 });
}
