import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signRecipients, signFields } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// PUT /api/sign/recipients/[id]
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { name, email, role, color } = await request.json();

  const [updated] = await db
    .update(signRecipients)
    .set({
      name: name?.trim(),
      email: email?.trim().toLowerCase(),
      role,
      color,
    })
    .where(eq(signRecipients.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/sign/recipients/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  // Also delete associated fields
  await db.delete(signFields).where(eq(signFields.recipientId, id));
  await db.delete(signRecipients).where(eq(signRecipients.id, id));

  return NextResponse.json({ success: true });
}
