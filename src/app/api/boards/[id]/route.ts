import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  boards,
  groups,
  columns,
  items,
  cellValues,
  workspaceMembers,
  users,
} from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

// GET /api/boards/[id] — get full board data (groups, columns, items, cells)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Get board
  const [board] = await db
    .select()
    .from(boards)
    .where(eq(boards.id, id))
    .limit(1);

  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  // Check membership
  const [member] = await db
    .select()
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, board.workspaceId),
        eq(workspaceMembers.userId, session.user.id)
      )
    )
    .limit(1);

  if (!member) return NextResponse.json({ error: "Not a member" }, { status: 403 });

  // Fetch everything in parallel
  const [boardGroups, boardColumns, boardItems, members] = await Promise.all([
    db
      .select()
      .from(groups)
      .where(eq(groups.boardId, id))
      .orderBy(asc(groups.position)),
    db
      .select()
      .from(columns)
      .where(eq(columns.boardId, id))
      .orderBy(asc(columns.position)),
    db
      .select()
      .from(items)
      .where(eq(items.boardId, id))
      .orderBy(asc(items.position)),
    db
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        name: users.name,
        email: users.email,
        image: users.image,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, board.workspaceId)),
  ]);

  // Get all cell values for items in this board
  const itemIds = boardItems.map((item) => item.id);
  let cells: Array<{
    itemId: string;
    columnId: string;
    textValue: string | null;
    numberValue: number | null;
    booleanValue: boolean | null;
    dateValue: Date | null;
    jsonValue: unknown;
  }> = [];

  if (itemIds.length > 0) {
    cells = await db
      .select()
      .from(cellValues)
      .where(
        // Get all cells for items that belong to this board
        eq(cellValues.itemId, boardItems[0]?.id ?? "")
      );

    // Actually fetch all items' cells (use a proper approach)
    cells = [];
    for (const item of boardItems) {
      const itemCells = await db
        .select()
        .from(cellValues)
        .where(eq(cellValues.itemId, item.id));
      cells.push(...itemCells);
    }
  }

  // Build a map: itemId -> { columnId: value }
  const cellMap: Record<string, Record<string, unknown>> = {};
  for (const cell of cells) {
    if (!cellMap[cell.itemId]) cellMap[cell.itemId] = {};
    cellMap[cell.itemId][cell.columnId] = {
      textValue: cell.textValue,
      numberValue: cell.numberValue,
      booleanValue: cell.booleanValue,
      dateValue: cell.dateValue,
      jsonValue: cell.jsonValue,
    };
  }

  return NextResponse.json({
    ...board,
    groups: boardGroups,
    columns: boardColumns,
    items: boardItems.map((item) => ({
      ...item,
      values: cellMap[item.id] || {},
    })),
    members,
  });
}

// PATCH /api/boards/[id] — update board
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json();
  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) update.name = body.name;
  if (body.description !== undefined) update.description = body.description;
  if (body.color !== undefined) update.color = body.color;
  if (body.visibility !== undefined) update.visibility = body.visibility;

  const [updated] = await db
    .update(boards)
    .set(update)
    .where(eq(boards.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/boards/[id] — delete board
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(boards).where(eq(boards.id, id));
  return NextResponse.json({ message: "Deleted" });
}
