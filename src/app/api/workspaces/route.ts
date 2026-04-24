import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces, workspaceMembers } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

// GET /api/workspaces — list workspaces the user is a member of
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      color: workspaces.color,
      ownerId: workspaces.ownerId,
      role: workspaceMembers.role,
      createdAt: workspaces.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, session.user.id))
    .orderBy(desc(workspaces.createdAt));

  return NextResponse.json(results);
}

// POST /api/workspaces — create a workspace
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, color } = await request.json();

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: name.trim(),
      description: description || null,
      color: color || "#3b82f6",
      ownerId: session.user.id,
    })
    .returning();

  // Add creator as owner member
  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId: session.user.id,
    role: "owner",
  });

  return NextResponse.json(workspace, { status: 201 });
}
