import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signDocuments, signEvents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// POST /api/sign/documents/[id]/void
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { reason } = await request.json().catch(() => ({ reason: null }));

  const [doc] = await db
    .select()
    .from(signDocuments)
    .where(eq(signDocuments.id, id))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (doc.status === "completed") {
    return NextResponse.json({ error: "Completed documents cannot be voided" }, { status: 400 });
  }

  await db
    .update(signDocuments)
    .set({ status: "voided", updatedAt: new Date() })
    .where(eq(signDocuments.id, id));

  await db.insert(signEvents).values({
    documentId: id,
    eventType: "document_voided",
    description: `Document voided by ${session.user.name || session.user.email}${reason ? `: ${reason}` : ""}`,
  });

  return NextResponse.json({ success: true });
}
