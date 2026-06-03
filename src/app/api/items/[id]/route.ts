import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { items } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/items/[id] — update item name, group, position
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
  if (body.groupId !== undefined) update.groupId = body.groupId;
  if (body.position !== undefined) update.position = body.position;
  if (body.startDate !== undefined) update.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) update.endDate = body.endDate ? new Date(body.endDate) : null;

  const [updated] = await db
    .update(items)
    .set(update)
    .where(eq(items.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/items/[id] — delete item
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(items).where(eq(items.id, id));
  return NextResponse.json({ message: "Deleted" });
}
