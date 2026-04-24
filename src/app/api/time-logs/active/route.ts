import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { timeLogs, employees, workshops, empProjects, empTasks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// GET /api/time-logs/active?badge=EMP001
// Public-ish — called from the time-clock kiosk
// Returns employee info + any active log for that badge code
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const badge = searchParams.get("badge");

  if (!badge) {
    return NextResponse.json({ error: "badge is required" }, { status: 400 });
  }

  const [emp] = await db
    .select()
    .from(employees)
    .where(eq(employees.employeeId, badge.toUpperCase()));

  if (!emp) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  if (emp.status !== "active") {
    return NextResponse.json({ error: "Employee is not active" }, { status: 403 });
  }

  // Check for active log
  const [activeLog] = await db
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
      status: timeLogs.status,
    })
    .from(timeLogs)
    .leftJoin(workshops, eq(workshops.id, timeLogs.workshopId))
    .leftJoin(empProjects, eq(empProjects.id, timeLogs.projectId))
    .leftJoin(empTasks, eq(empTasks.id, timeLogs.taskId))
    .where(and(eq(timeLogs.employeeId, emp.id), eq(timeLogs.status, "active")));

  return NextResponse.json({ employee: emp, activeLog: activeLog ?? null });
}
