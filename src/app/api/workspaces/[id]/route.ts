import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers, boards } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

async function getWorkspaceMembership(workspaceId: string, userId: string) {
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    )
    .limit(1);
  return member;
}

// GET /api/workspaces/[id] — get workspace with boards
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await getWorkspaceMembership(id, session.user.id);
  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);

  if (!workspace) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const boardsList = await db
    .select()
    .from(boards)
    .where(eq(boards.workspaceId, id))
    .orderBy(boards.position, desc(boards.createdAt));

  const members = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, id));

  return NextResponse.json({ ...workspace, boards: boardsList, members });
}

// PATCH /api/workspaces/[id] — update workspace
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await getWorkspaceMembership(id, session.user.id);
  if (!member || member.role === "member") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const body = await request.json();
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.color !== undefined) update.color = body.color;

  const [updated] = await db
    .update(workspaces)
    .set(update)
    .where(eq(workspaces.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/workspaces/[id] — delete workspace
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const member = await getWorkspaceMembership(id, session.user.id);
  if (!member || member.role !== "owner") {
    return NextResponse.json({ error: "Only workspace owner can delete" }, { status: 403 });
  }

  await db.delete(workspaces).where(eq(workspaces.id, id));
  return NextResponse.json({ message: "Deleted" });
}
