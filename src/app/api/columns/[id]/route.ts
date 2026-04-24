import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { columns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/columns/[id] — update column
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
  if (body.width !== undefined) update.width = body.width;
  if (body.position !== undefined) update.position = body.position;
  if (body.config !== undefined) update.config = body.config;

  const [updated] = await db
    .update(columns)
    .set(update)
    .where(eq(columns.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/columns/[id] — delete column (and its cell values via cascade)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(columns).where(eq(columns.id, id));
  return NextResponse.json({ message: "Deleted" });
}
