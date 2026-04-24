import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { groups } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/groups/[id] — update group
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json();
  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.color !== undefined) update.color = body.color;
  if (body.position !== undefined) update.position = body.position;
  if (body.collapsed !== undefined) update.collapsed = body.collapsed;

  const [updated] = await db
    .update(groups)
    .set(update)
    .where(eq(groups.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/groups/[id] — delete group (and its items)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(groups).where(eq(groups.id, id));
  return NextResponse.json({ message: "Deleted" });
}
