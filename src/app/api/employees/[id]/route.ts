import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { employees, timeLogs, workshops, empProjects, empTasks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/employees/[id] — get one employee with recent logs
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [emp] = await db.select().from(employees).where(eq(employees.id, id));
  if (!emp) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await db
    .select({
      id: timeLogs.id,
      employeeId: timeLogs.employeeId,
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
    })
    .from(timeLogs)
    .leftJoin(workshops, eq(workshops.id, timeLogs.workshopId))
    .leftJoin(empProjects, eq(empProjects.id, timeLogs.projectId))
    .leftJoin(empTasks, eq(empTasks.id, timeLogs.taskId))
    .where(eq(timeLogs.employeeId, id))
    .orderBy(desc(timeLogs.checkInAt))
    .limit(200);

  return NextResponse.json({ ...emp, logs });
}

// PATCH /api/employees/[id] — update employee
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(employees)
    .set({
      name: body.name,
      email: body.email ?? null,
      phone: body.phone ?? null,
      department: body.department ?? null,
      designation: body.designation ?? null,
      joiningDate: body.joiningDate ? new Date(body.joiningDate) : null,
      avatarUrl: body.avatarUrl ?? null,
      status: body.status,
      updatedAt: new Date(),
    })
    .where(eq(employees.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/employees/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(employees).where(eq(employees.id, id));
  return NextResponse.json({ success: true });
}
