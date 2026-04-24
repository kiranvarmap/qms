import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signDocuments, signRecipients } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

// POST /api/sign/recipients — add recipient to a document
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId, name, email, role = "signer", color } = await request.json();

  if (!documentId || !name || !email) {
    return NextResponse.json({ error: "documentId, name, and email are required" }, { status: 400 });
  }

  // Check document exists and is still draft
  const [doc] = await db
    .select()
    .from(signDocuments)
    .where(eq(signDocuments.id, documentId))
    .limit(1);

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  if (doc.status !== "draft") {
    return NextResponse.json({ error: "Cannot modify recipients after document is sent" }, { status: 400 });
  }

  // Auto-assign next order
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${signRecipients.order}), 0)`.mapWith(Number) })
    .from(signRecipients)
    .where(eq(signRecipients.documentId, documentId));

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899"];
  const existingCount = maxOrder;

  const [recipient] = await db
    .insert(signRecipients)
    .values({
      documentId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      order: maxOrder + 1,
      color: color || COLORS[existingCount % COLORS.length],
    })
    .returning();

  return NextResponse.json(recipient, { status: 201 });
}
