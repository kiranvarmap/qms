import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signFields } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PUT /api/sign/fields/[id] — update position/size
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { x, y, width, height, recipientId, label, required } = await request.json();

  const [updated] = await db
    .update(signFields)
    .set({
      x: x !== undefined ? x : undefined,
      y: y !== undefined ? y : undefined,
      width: width !== undefined ? width : undefined,
      height: height !== undefined ? height : undefined,
      recipientId: recipientId !== undefined ? recipientId : undefined,
      label: label !== undefined ? label : undefined,
      required: required !== undefined ? required : undefined,
    })
    .where(eq(signFields.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/sign/fields/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await db.delete(signFields).where(eq(signFields.id, id));
  return NextResponse.json({ success: true });
}
