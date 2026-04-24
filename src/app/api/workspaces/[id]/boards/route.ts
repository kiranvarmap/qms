import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { boards, groups, columns, workspaceMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// POST /api/workspaces/[id]/boards — create a board
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: workspaceId } = await params;

  // Check membership
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  const { name, description, color } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Create board
  const [board] = await db
    .insert(boards)
    .values({
      workspaceId,
      name: name.trim(),
      description: description || null,
      color: color || "#3b82f6",
      createdBy: session.user.id,
    })
    .returning();

  // Create default group
  const [defaultGroup] = await db
    .insert(groups)
    .values({
      boardId: board.id,
      name: "New Group",
      color: "#3b82f6",
      position: 1,
    })
    .returning();

  // Create default columns: Status, Person, Date, Priority
  const defaultColumns = [
    {
      boardId: board.id,
      name: "Status",
      type: "status" as const,
      position: 1,
      width: 140,
      config: {
        labels: [
          { id: "1", text: "Working on it", color: "#fdab3d" },
          { id: "2", text: "Done", color: "#00c875" },
          { id: "3", text: "Stuck", color: "#e2445c" },
          { id: "4", text: "Not started", color: "#c4c4c4" },
        ],
      },
    },
    {
      boardId: board.id,
      name: "Person",
      type: "person" as const,
      position: 2,
      width: 140,
      config: {},
    },
    {
      boardId: board.id,
      name: "Date",
      type: "date" as const,
      position: 3,
      width: 140,
      config: {},
    },
    {
      boardId: board.id,
      name: "Priority",
      type: "priority" as const,
      position: 4,
      width: 140,
      config: {
        labels: [
          { id: "1", text: "Critical", color: "#333333" },
          { id: "2", text: "High", color: "#401694" },
          { id: "3", text: "Medium", color: "#5559df" },
          { id: "4", text: "Low", color: "#579bfc" },
        ],
      },
    },
  ];

  await db.insert(columns).values(defaultColumns);

  return NextResponse.json(
    { ...board, groups: [defaultGroup] },
    { status: 201 }
  );
}
