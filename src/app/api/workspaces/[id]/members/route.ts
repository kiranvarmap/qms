import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaceMembers, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/workspaces/[id]/members — list members with their permissions
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workspaceId } = await params;

  const [self] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, session.user.id)))
    .limit(1);

  if (!self && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      canAccessBoards: workspaceMembers.canAccessBoards,
      canAccessInspections: workspaceMembers.canAccessInspections,
      canAccessDocSign: workspaceMembers.canAccessDocSign,
      canAccessTimeClock: workspaceMembers.canAccessTimeClock,
      joinedAt: workspaceMembers.joinedAt,
      userName: users.name,
      userEmail: users.email,
      userRole: users.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  return NextResponse.json(members);
}

// POST /api/workspaces/[id]/members — add a user or update permissions
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workspaceId } = await params;

  const [self] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, session.user.id)))
    .limit(1);

  const canManage =
    session.user.role === "admin" || self?.role === "owner" || self?.role === "admin";

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    userId,
    role = "member",
    canAccessBoards = true,
    canAccessInspections = false,
    canAccessDocSign = false,
    canAccessTimeClock = false,
  } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Upsert — update if exists, insert if not
  const [existing] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(workspaceMembers)
      .set({ role, canAccessBoards, canAccessInspections, canAccessDocSign, canAccessTimeClock })
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
      .returning();
    return NextResponse.json(updated);
  }

  const [created] = await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role, canAccessBoards, canAccessInspections, canAccessDocSign, canAccessTimeClock })
    .returning();

  return NextResponse.json(created, { status: 201 });
}

// DELETE /api/workspaces/[id]/members?userId=... — remove a member
export async function DELETE(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: workspaceId } = await params;
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) return NextResponse.json({ error: "userId query param required" }, { status: 400 });

  const [self] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, session.user.id)))
    .limit(1);

  const canManage =
    session.user.role === "admin" || self?.role === "owner" || self?.role === "admin";

  if (!canManage && session.user.id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));

  return NextResponse.json({ ok: true });
}
