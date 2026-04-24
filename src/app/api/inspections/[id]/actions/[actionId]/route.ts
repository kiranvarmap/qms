import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { inspectionActions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PATCH /api/inspections/[id]/actions/[actionId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { actionId } = await params;
  const body = await request.json();

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) update.status = body.status;
  if (body.priority !== undefined) update.priority = body.priority;
  if (body.title !== undefined) update.title = body.title;
  if (body.assignedTo !== undefined) update.assignedTo = body.assignedTo;

  const [updated] = await db
    .update(inspectionActions)
    .set(update)
    .where(eq(inspectionActions.id, actionId))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/inspections/[id]/actions/[actionId]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; actionId: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { actionId } = await params;

  await db.delete(inspectionActions).where(eq(inspectionActions.id, actionId));
  return NextResponse.json({ message: "Deleted" });
}
