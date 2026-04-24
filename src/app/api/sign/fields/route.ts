import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { signFields } from "@/lib/db/schema";

// POST /api/sign/fields — add one or multiple fields
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Accept single object or array
  const items = Array.isArray(body) ? body : [body];

  const values = items.map((f) => ({
    documentId: f.documentId,
    recipientId: f.recipientId || null,
    type: f.type,
    page: f.page,
    x: f.x,
    y: f.y,
    width: f.width,
    height: f.height,
    required: f.required !== false,
    label: f.label || null,
  }));

  const inserted = await db.insert(signFields).values(values).returning();
  return NextResponse.json(Array.isArray(body) ? inserted : inserted[0], { status: 201 });
}
