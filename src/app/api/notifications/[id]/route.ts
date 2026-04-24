import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/notifications/[id] — mark as read
export async function PATCH(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, session.user.id))
    );

  return NextResponse.json({ ok: true });
}

// DELETE /api/notifications/[id]
export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await db
    .delete(notifications)
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, session.user.id))
    );

  return NextResponse.json({ ok: true });
}
