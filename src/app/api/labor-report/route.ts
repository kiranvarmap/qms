import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { timeLogs, employees, workspaces, boards, items } from "@/lib/db/schema";
import { and, desc, eq, isNotNull } from "drizzle-orm";

// GET /api/labor-report[?workspaceId=&boardId=&itemId=]
// Returns work-linked time logs (scope-ladder ancestry) with names + durations,
// for roll-up at task / board / workspace level (Plan B.5). The client groups
// these into the three levels; this keeps the query simple and flexible.
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = new URL(req.url).searchParams;
  const fWorkspace = sp.get("workspaceId");
  const fBoard = sp.get("boardId");
  const fItem = sp.get("itemId");

  const conditions = [isNotNull(timeLogs.workspaceId)];
  if (fWorkspace) conditions.push(eq(timeLogs.workspaceId, fWorkspace));
  if (fBoard) conditions.push(eq(timeLogs.boardId, fBoard));
  if (fItem) conditions.push(eq(timeLogs.itemId, fItem));

  const rows = await db
    .select({
      id: timeLogs.id,
      employeeName: employees.name,
      employeeCode: employees.employeeId,
      workspaceId: timeLogs.workspaceId,
      workspaceName: workspaces.name,
      boardId: timeLogs.boardId,
      boardName: boards.name,
      itemId: timeLogs.itemId,
      itemName: items.name,
      linkLevel: timeLogs.linkLevel,
      durationMinutes: timeLogs.durationMinutes,
      status: timeLogs.status,
      checkInAt: timeLogs.checkInAt,
      checkOutAt: timeLogs.checkOutAt,
    })
    .from(timeLogs)
    .innerJoin(employees, eq(employees.id, timeLogs.employeeId))
    .leftJoin(workspaces, eq(workspaces.id, timeLogs.workspaceId))
    .leftJoin(boards, eq(boards.id, timeLogs.boardId))
    .leftJoin(items, eq(items.id, timeLogs.itemId))
    .where(and(...conditions))
    .orderBy(desc(timeLogs.checkInAt));

  return NextResponse.json({ data: rows });
}
