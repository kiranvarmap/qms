import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { forms, formFields, boards } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { randomBytes } from "crypto";

type Params = { params: Promise<{ id: string }> };

// GET /api/boards/[id]/forms
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: boardId } = await params;

  const rows = await db
    .select()
    .from(forms)
    .where(eq(forms.boardId, boardId))
    .orderBy(forms.createdAt);

  return NextResponse.json(rows);
}

// POST /api/boards/[id]/forms
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: boardId } = await params;

  const [board] = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const { name, description, isPublic, submitMessage } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Generate unique slug
  const slug = randomBytes(8).toString("hex");

  const [form] = await db
    .insert(forms)
    .values({
      boardId,
      name: name.trim(),
      description: description ?? null,
      isPublic: isPublic ?? true,
      slug,
      submitMessage: submitMessage ?? "Thank you! Your response has been recorded.",
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(form, { status: 201 });
}
