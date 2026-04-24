import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { automations, automationLogs } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/automations/[id]
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [automation] = await db.select().from(automations).where(eq(automations.id, id)).limit(1);
  if (!automation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await db
    .select()
    .from(automationLogs)
    .where(eq(automationLogs.automationId, id))
    .orderBy(desc(automationLogs.triggeredAt))
    .limit(20);

  return NextResponse.json({ ...automation, logs });
}

// PATCH /api/automations/[id]
export async function PATCH(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const [existing] = await db.select().from(automations).where(eq(automations.id, id)).limit(1);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updates: Partial<typeof existing> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.triggerType !== undefined) updates.triggerType = body.triggerType;
  if (body.triggerConfig !== undefined) updates.triggerConfig = body.triggerConfig;
  if (body.actionType !== undefined) updates.actionType = body.actionType;
  if (body.actionConfig !== undefined) updates.actionConfig = body.actionConfig;
  updates.updatedAt = new Date();

  const [updated] = await db
    .update(automations)
    .set(updates)
    .where(eq(automations.id, id))
    .returning();

  return NextResponse.json(updated);
}

// DELETE /api/automations/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db.delete(automations).where(eq(automations.id, id));
  return NextResponse.json({ ok: true });
}
