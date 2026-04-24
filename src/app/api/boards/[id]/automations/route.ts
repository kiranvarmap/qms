import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { automations, automationLogs, boards } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/boards/[id]/automations
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: boardId } = await params;

  const rows = await db
    .select()
    .from(automations)
    .where(eq(automations.boardId, boardId))
    .orderBy(automations.createdAt);

  return NextResponse.json(rows);
}

// POST /api/boards/[id]/automations
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: boardId } = await params;

  const [board] = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const { name, triggerType, triggerConfig, actionType, actionConfig } = await req.json();

  if (!name?.trim() || !triggerType || !actionType) {
    return NextResponse.json({ error: "name, triggerType and actionType are required" }, { status: 400 });
  }

  const [automation] = await db
    .insert(automations)
    .values({
      boardId,
      name: name.trim(),
      triggerType,
      triggerConfig: triggerConfig ?? {},
      actionType,
      actionConfig: actionConfig ?? {},
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(automation, { status: 201 });
}
