import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaceMembers, workspaceLabels } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/[id]/labels
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Verify user is a member of this workspace
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, session.user.id)))
    .limit(1);

  if (!membership && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [row] = await db
    .select()
    .from(workspaceLabels)
    .where(eq(workspaceLabels.workspaceId, id))
    .limit(1);

  // Return defaults if no custom labels set yet
  return NextResponse.json(
    row ?? {
      workspaceId: id,
      boardLabel: "Board",
      groupLabel: "Group",
      itemLabel: "Item",
      projectLabel: "Project",
      taskLabel: "Task",
      workshopLabel: "Workshop",
    }
  );
}

// PUT /api/workspaces/[id]/labels
export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Only workspace owner/admin or system admin can update labels
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, id), eq(workspaceMembers.userId, session.user.id)))
    .limit(1);

  const canEdit =
    session.user.role === "admin" ||
    membership?.role === "owner" ||
    membership?.role === "admin";

  if (!canEdit) {
    return NextResponse.json({ error: "Forbidden – only workspace owner/admin can update labels" }, { status: 403 });
  }

  const body = await req.json();
  const {
    boardLabel,
    groupLabel,
    itemLabel,
    projectLabel,
    taskLabel,
    workshopLabel,
  } = body;

  const [existing] = await db
    .select()
    .from(workspaceLabels)
    .where(eq(workspaceLabels.workspaceId, id))
    .limit(1);

  let result;
  if (existing) {
    [result] = await db
      .update(workspaceLabels)
      .set({
        boardLabel: boardLabel ?? existing.boardLabel,
        groupLabel: groupLabel ?? existing.groupLabel,
        itemLabel: itemLabel ?? existing.itemLabel,
        projectLabel: projectLabel ?? existing.projectLabel,
        taskLabel: taskLabel ?? existing.taskLabel,
        workshopLabel: workshopLabel ?? existing.workshopLabel,
        updatedAt: new Date(),
      })
      .where(eq(workspaceLabels.workspaceId, id))
      .returning();
  } else {
    [result] = await db
      .insert(workspaceLabels)
      .values({
        workspaceId: id,
        boardLabel: boardLabel ?? "Board",
        groupLabel: groupLabel ?? "Group",
        itemLabel: itemLabel ?? "Item",
        projectLabel: projectLabel ?? "Project",
        taskLabel: taskLabel ?? "Task",
        workshopLabel: workshopLabel ?? "Workshop",
      })
      .returning();
  }

  return NextResponse.json(result);
}
