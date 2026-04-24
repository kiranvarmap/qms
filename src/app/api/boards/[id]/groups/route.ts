import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// POST /api/boards/[id]/groups — create a group
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: boardId } = await params;

  const { name, color } = await request.json();

  // Get max position
  const existing = await db
    .select({ position: groups.position })
    .from(groups)
    .where(eq(groups.boardId, boardId))
    .orderBy(groups.position);

  const maxPos = existing.length > 0 ? existing[existing.length - 1].position : 0;

  const [group] = await db
    .insert(groups)
    .values({
      boardId,
      name: name?.trim() || "New Group",
      color: color || "#3b82f6",
      position: maxPos + 1,
    })
    .returning();

  return NextResponse.json(group, { status: 201 });
}
