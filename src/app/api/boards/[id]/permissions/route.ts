import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  boards,
  workspaceMembers,
  boardColumnPermissions,
  boardItemPermissions,
  users,
  columns,
  items,
} from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

async function ensureAccess(boardId: string, userId: string, userRole: string) {
  const [board] = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  if (!board) return null;

  if (userRole === "admin") return board;

  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, board.workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  return membership ? board : null;
}

// GET /api/boards/[id]/permissions — get all column + row permissions for a board
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const board = await ensureAccess(boardId, session.user.id, session.user.role ?? "user");
  if (!board) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [colPerms, rowPerms] = await Promise.all([
    db
      .select({
        id: boardColumnPermissions.id,
        columnId: boardColumnPermissions.columnId,
        userId: boardColumnPermissions.userId,
        canView: boardColumnPermissions.canView,
        canEdit: boardColumnPermissions.canEdit,
        userName: users.name,
        userEmail: users.email,
        columnName: columns.name,
      })
      .from(boardColumnPermissions)
      .leftJoin(users, eq(users.id, boardColumnPermissions.userId))
      .leftJoin(columns, eq(columns.id, boardColumnPermissions.columnId))
      .where(eq(boardColumnPermissions.boardId, boardId)),

    db
      .select({
        id: boardItemPermissions.id,
        itemId: boardItemPermissions.itemId,
        userId: boardItemPermissions.userId,
        canView: boardItemPermissions.canView,
        canEdit: boardItemPermissions.canEdit,
        userName: users.name,
        userEmail: users.email,
        itemName: items.name,
      })
      .from(boardItemPermissions)
      .leftJoin(users, eq(users.id, boardItemPermissions.userId))
      .leftJoin(items, eq(items.id, boardItemPermissions.itemId))
      .where(eq(boardItemPermissions.boardId, boardId)),
  ]);

  return NextResponse.json({ columnPermissions: colPerms, rowPermissions: rowPerms });
}

// POST /api/boards/[id]/permissions — upsert a column or row permission
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const board = await ensureAccess(boardId, session.user.id, session.user.role ?? "user");
  if (!board) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Only workspace owner/admin or system admin can manage permissions
  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, board.workspaceId), eq(workspaceMembers.userId, session.user.id)))
    .limit(1);

  const canManage =
    session.user.role === "admin" || membership?.role === "owner" || membership?.role === "admin";

  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { type, userId, columnId, itemId, canView = true, canEdit = false } = body;

  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  if (type === "column") {
    // Upsert column permission
    const [existing] = await db
      .select()
      .from(boardColumnPermissions)
      .where(
        and(
          eq(boardColumnPermissions.boardId, boardId),
          eq(boardColumnPermissions.userId, userId),
          columnId ? eq(boardColumnPermissions.columnId, columnId) : eq(boardColumnPermissions.boardId, boardId)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(boardColumnPermissions)
        .set({ canView, canEdit })
        .where(eq(boardColumnPermissions.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(boardColumnPermissions)
      .values({ boardId, userId, columnId: columnId ?? null, canView, canEdit })
      .returning();
    return NextResponse.json(created, { status: 201 });
  }

  if (type === "row") {
    if (!itemId) return NextResponse.json({ error: "itemId required for row permissions" }, { status: 400 });

    const [existing] = await db
      .select()
      .from(boardItemPermissions)
      .where(
        and(
          eq(boardItemPermissions.boardId, boardId),
          eq(boardItemPermissions.itemId, itemId),
          eq(boardItemPermissions.userId, userId)
        )
      )
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(boardItemPermissions)
        .set({ canView, canEdit })
        .where(eq(boardItemPermissions.id, existing.id))
        .returning();
      return NextResponse.json(updated);
    }

    const [created] = await db
      .insert(boardItemPermissions)
      .values({ boardId, itemId, userId, canView, canEdit })
      .returning();
    return NextResponse.json(created, { status: 201 });
  }

  return NextResponse.json({ error: "type must be 'column' or 'row'" }, { status: 400 });
}

// DELETE /api/boards/[id]/permissions?permId=...&type=column|row
export async function DELETE(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const board = await ensureAccess(boardId, session.user.id, session.user.role ?? "user");
  if (!board) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const permId = searchParams.get("permId");
  const type = searchParams.get("type");

  if (!permId || !type) {
    return NextResponse.json({ error: "permId and type query params required" }, { status: 400 });
  }

  if (type === "column") {
    await db.delete(boardColumnPermissions).where(eq(boardColumnPermissions.id, permId));
  } else if (type === "row") {
    await db.delete(boardItemPermissions).where(eq(boardItemPermissions.id, permId));
  }

  return NextResponse.json({ ok: true });
}
