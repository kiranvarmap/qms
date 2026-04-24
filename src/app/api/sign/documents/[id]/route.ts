import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  signDocuments,
  signRecipients,
  signFields,
  signEvents,
  users,
} from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { unlink } from "fs/promises";
import path from "path";

// GET /api/sign/documents/[id]
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select({ doc: signDocuments, creatorName: users.name })
    .from(signDocuments)
    .leftJoin(users, eq(users.id, signDocuments.createdBy))
    .where(eq(signDocuments.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recipients = await db
    .select()
    .from(signRecipients)
    .where(eq(signRecipients.documentId, id))
    .orderBy(asc(signRecipients.order));

  const fields = await db
    .select()
    .from(signFields)
    .where(eq(signFields.documentId, id))
    .orderBy(asc(signFields.createdAt));

  const events = await db
    .select()
    .from(signEvents)
    .where(eq(signEvents.documentId, id))
    .orderBy(asc(signEvents.createdAt));

  return NextResponse.json({
    ...doc.doc,
    creatorName: doc.creatorName,
    recipients,
    fields,
    events,
  });
}

// PATCH /api/sign/documents/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  const [updated] = await db
    .update(signDocuments)
    .set({
      title: body.title,
      message: body.message ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      pageCount: body.pageCount ?? undefined,
      updatedAt: new Date(),
    })
    .where(eq(signDocuments.id, id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/sign/documents/[id]
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const [doc] = await db
    .select()
    .from(signDocuments)
    .where(eq(signDocuments.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete file from disk
  try {
    const filePath = path.join(process.cwd(), "public", doc.filePath);
    await unlink(filePath);
  } catch { /* ignore missing file */ }

  await db.delete(signDocuments).where(eq(signDocuments.id, id));
  return NextResponse.json({ success: true });
}
