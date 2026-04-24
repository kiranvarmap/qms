import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeLogs, employees, workshops, empProjects, empTasks } from "@/lib/db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

// GET /api/emp-reports?type=overview|employee|project|workshop|task&from=&to=&id=
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "overview";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  // const targetId = searchParams.get("id"); // reserved for future single-record drill-down

  const baseConditions = [];
  if (from) baseConditions.push(gte(timeLogs.checkInAt, new Date(from)));
  if (to) baseConditions.push(lte(timeLogs.checkInAt, new Date(to)));

  const allLogs = await db
    .select({
      id: timeLogs.id,
      employeeId: timeLogs.employeeId,
      employeeName: employees.name,
      employeeCode: employees.employeeId,
      department: employees.department,
      workshopId: timeLogs.workshopId,
      workshopName: workshops.name,
      projectId: timeLogs.projectId,
      projectName: empProjects.name,
      taskId: timeLogs.taskId,
      taskName: empTasks.name,
      checkInAt: timeLogs.checkInAt,
      checkOutAt: timeLogs.checkOutAt,
      durationMinutes: timeLogs.durationMinutes,
      status: timeLogs.status,
    })
    .from(timeLogs)
    .leftJoin(employees, eq(employees.id, timeLogs.employeeId))
    .leftJoin(workshops, eq(workshops.id, timeLogs.workshopId))
    .leftJoin(empProjects, eq(empProjects.id, timeLogs.projectId))
    .leftJoin(empTasks, eq(empTasks.id, timeLogs.taskId))
    .where(baseConditions.length > 0 ? and(...baseConditions) : undefined)
    .orderBy(desc(timeLogs.checkInAt));

  if (type === "overview") {
    const totalMinutes = allLogs.reduce((s, l) => s + (l.durationMinutes ?? 0), 0);
    const activeSessions = allLogs.filter((l) => l.status === "active").length;
    const uniqueEmployees = new Set(allLogs.map((l) => l.employeeId)).size;
    const uniqueProjects = new Set(allLogs.filter((l) => l.projectId).map((l) => l.projectId)).size;
    const uniqueWorkshops = new Set(allLogs.filter((l) => l.workshopId).map((l) => l.workshopId)).size;

    // Recently active employees
    const recentMap: Record<string, typeof allLogs[0]> = {};
    for (const l of allLogs) {
      if (!recentMap[l.employeeId]) recentMap[l.employeeId] = l;
    }

    return NextResponse.json({
      totalMinutes,
      totalSessions: allLogs.length,
      activeSessions,
      uniqueEmployees,
      uniqueProjects,
      uniqueWorkshops,
      recentActivity: Object.values(recentMap).slice(0, 10),
    });
  }

  if (type === "employee") {
    // Group logs by employee
    const empMap: Record<string, { name: string; code: string; department: string | null; minutes: number; sessions: number; active: number; logs: typeof allLogs }> = {};
    for (const l of allLogs) {
      if (!empMap[l.employeeId]) {
        empMap[l.employeeId] = { name: l.employeeName ?? "", code: l.employeeCode ?? "", department: l.department ?? null, minutes: 0, sessions: 0, active: 0, logs: [] };
      }
      empMap[l.employeeId].minutes += l.durationMinutes ?? 0;
      empMap[l.employeeId].sessions += 1;
      if (l.status === "active") empMap[l.employeeId].active += 1;
      empMap[l.employeeId].logs.push(l);
    }
    return NextResponse.json(Object.entries(empMap).map(([id, v]) => ({ employeeId: id, ...v })));
  }

  if (type === "project") {
    const projMap: Record<string, { name: string; minutes: number; sessions: number; employees: Set<string>; tasks: Record<string, { name: string; minutes: number; sessions: number }> }> = {};
    for (const l of allLogs) {
      const pid = l.projectId ?? "unassigned";
      const pname = l.projectName ?? "Unassigned";
      if (!projMap[pid]) projMap[pid] = { name: pname, minutes: 0, sessions: 0, employees: new Set(), tasks: {} };
      projMap[pid].minutes += l.durationMinutes ?? 0;
      projMap[pid].sessions += 1;
      projMap[pid].employees.add(l.employeeId);
      if (l.taskId) {
        if (!projMap[pid].tasks[l.taskId]) projMap[pid].tasks[l.taskId] = { name: l.taskName ?? "", minutes: 0, sessions: 0 };
        projMap[pid].tasks[l.taskId].minutes += l.durationMinutes ?? 0;
        projMap[pid].tasks[l.taskId].sessions += 1;
      }
    }
    return NextResponse.json(
      Object.entries(projMap).map(([id, v]) => ({
        projectId: id,
        name: v.name,
        minutes: v.minutes,
        sessions: v.sessions,
        uniqueEmployees: v.employees.size,
        taskBreakdown: Object.entries(v.tasks).map(([tid, t]) => ({ taskId: tid, ...t })),
      }))
    );
  }

  if (type === "workshop") {
    const wsMap: Record<string, { name: string; minutes: number; sessions: number; employees: Set<string>; projects: Record<string, { name: string; minutes: number }> }> = {};
    for (const l of allLogs) {
      const wid = l.workshopId ?? "unassigned";
      const wname = l.workshopName ?? "Unassigned";
      if (!wsMap[wid]) wsMap[wid] = { name: wname, minutes: 0, sessions: 0, employees: new Set(), projects: {} };
      wsMap[wid].minutes += l.durationMinutes ?? 0;
      wsMap[wid].sessions += 1;
      wsMap[wid].employees.add(l.employeeId);
      if (l.projectId) {
        const pid = l.projectId;
        if (!wsMap[wid].projects[pid]) wsMap[wid].projects[pid] = { name: l.projectName ?? "", minutes: 0 };
        wsMap[wid].projects[pid].minutes += l.durationMinutes ?? 0;
      }
    }
    return NextResponse.json(
      Object.entries(wsMap).map(([id, v]) => ({
        workshopId: id,
        name: v.name,
        minutes: v.minutes,
        sessions: v.sessions,
        uniqueEmployees: v.employees.size,
        projectBreakdown: Object.entries(v.projects).map(([pid, p]) => ({ projectId: pid, ...p })),
      }))
    );
  }

  if (type === "task") {
    const taskMap: Record<string, { name: string; projectName: string; minutes: number; sessions: number; employees: Set<string> }> = {};
    for (const l of allLogs) {
      const tid = l.taskId ?? "unassigned";
      const tname = l.taskName ?? "Unassigned";
      if (!taskMap[tid]) taskMap[tid] = { name: tname, projectName: l.projectName ?? "", minutes: 0, sessions: 0, employees: new Set() };
      taskMap[tid].minutes += l.durationMinutes ?? 0;
      taskMap[tid].sessions += 1;
      taskMap[tid].employees.add(l.employeeId);
    }
    return NextResponse.json(
      Object.entries(taskMap).map(([id, v]) => ({
        taskId: id,
        name: v.name,
        projectName: v.projectName,
        minutes: v.minutes,
        sessions: v.sessions,
        uniqueEmployees: v.employees.size,
      }))
    );
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
