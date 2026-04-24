import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { boards, workspaceMembers, statusNotifications, columns } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

async function ensureBoardAccess(boardId: string, userId: string, userRole: string) {
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

// GET /api/boards/[id]/notifications — list all notification rules
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const board = await ensureBoardAccess(boardId, session.user.id, session.user.role ?? "user");
  if (!board) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const rules = await db
    .select({
      id: statusNotifications.id,
      boardId: statusNotifications.boardId,
      columnId: statusNotifications.columnId,
      triggerValue: statusNotifications.triggerValue,
      notifyUserIds: statusNotifications.notifyUserIds,
      emailSubject: statusNotifications.emailSubject,
      emailBody: statusNotifications.emailBody,
      isActive: statusNotifications.isActive,
      columnName: columns.name,
    })
    .from(statusNotifications)
    .leftJoin(columns, eq(columns.id, statusNotifications.columnId))
    .where(eq(statusNotifications.boardId, boardId));

  return NextResponse.json(rules);
}

// POST /api/boards/[id]/notifications — create a notification rule
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const board = await ensureBoardAccess(boardId, session.user.id, session.user.role ?? "user");
  if (!board) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [membership] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, board.workspaceId), eq(workspaceMembers.userId, session.user.id)))
    .limit(1);

  const canManage =
    session.user.role === "admin" || membership?.role === "owner" || membership?.role === "admin";

  if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { columnId, triggerValue, notifyUserIds = [], emailSubject, emailBody } = body;

  if (!columnId || !triggerValue) {
    return NextResponse.json({ error: "columnId and triggerValue are required" }, { status: 400 });
  }

  const [rule] = await db
    .insert(statusNotifications)
    .values({
      boardId,
      columnId,
      triggerValue,
      notifyUserIds,
      emailSubject: emailSubject ?? null,
      emailBody: emailBody ?? null,
    })
    .returning();

  return NextResponse.json(rule, { status: 201 });
}

// PATCH /api/boards/[id]/notifications — update a rule
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const board = await ensureBoardAccess(boardId, session.user.id, session.user.role ?? "user");
  if (!board) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { ruleId, notifyUserIds, emailSubject, emailBody, isActive, triggerValue } = body;

  if (!ruleId) return NextResponse.json({ error: "ruleId required" }, { status: 400 });

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (notifyUserIds !== undefined) updates.notifyUserIds = notifyUserIds;
  if (emailSubject !== undefined) updates.emailSubject = emailSubject;
  if (emailBody !== undefined) updates.emailBody = emailBody;
  if (isActive !== undefined) updates.isActive = isActive;
  if (triggerValue !== undefined) updates.triggerValue = triggerValue;

  const [updated] = await db
    .update(statusNotifications)
    .set(updates)
    .where(and(eq(statusNotifications.id, ruleId), eq(statusNotifications.boardId, boardId)))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/boards/[id]/notifications?ruleId=...
export async function DELETE(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: boardId } = await params;
  const board = await ensureBoardAccess(boardId, session.user.id, session.user.role ?? "user");
  if (!board) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const ruleId = searchParams.get("ruleId");
  if (!ruleId) return NextResponse.json({ error: "ruleId required" }, { status: 400 });

  await db
    .delete(statusNotifications)
    .where(and(eq(statusNotifications.id, ruleId), eq(statusNotifications.boardId, boardId)));

  return NextResponse.json({ ok: true });
}

// ── Trigger handler (re-exported from lib) ─────────────────────────────────
export { triggerStatusNotifications } from "@/lib/notifications";

