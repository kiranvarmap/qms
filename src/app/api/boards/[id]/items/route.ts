import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runAutomations } from "@/lib/automations";

// POST /api/boards/[id]/items — create an item (row)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: boardId } = await params;

  const { groupId, name } = await request.json();

  if (!groupId || !name?.trim()) {
    return NextResponse.json({ error: "Group and name are required" }, { status: 400 });
  }

  // Get max position in the group
  const existing = await db
    .select({ position: items.position })
    .from(items)
    .where(eq(items.groupId, groupId))
    .orderBy(items.position);

  const maxPos = existing.length > 0 ? existing[existing.length - 1].position : 0;

  const [item] = await db
    .insert(items)
    .values({
      boardId,
      groupId,
      name: name.trim(),
      position: maxPos + 1,
      createdBy: session.user.id,
    })
    .returning();

  // Fire item_created automations
  void runAutomations({ type: "item_created", boardId, itemId: item.id }).catch(() => {});

  return NextResponse.json({ ...item, values: {} }, { status: 201 });
}
