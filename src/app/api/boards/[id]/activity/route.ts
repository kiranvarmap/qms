import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { activityLog, users } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/boards/[id]/activity?itemId=...
export async function GET(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: boardId } = await params;

  const url = new URL(req.url);
  const itemId = url.searchParams.get("itemId");

  const conditions = itemId
    ? and(eq(activityLog.boardId, boardId), eq(activityLog.itemId, itemId))
    : eq(activityLog.boardId, boardId);

  const rows = await db
    .select({
      id: activityLog.id,
      action: activityLog.action,
      details: activityLog.details,
      createdAt: activityLog.createdAt,
      itemId: activityLog.itemId,
      userId: activityLog.userId,
      userName: users.name,
      userImage: users.image,
    })
    .from(activityLog)
    .innerJoin(users, eq(activityLog.userId, users.id))
    .where(conditions)
    .orderBy(desc(activityLog.createdAt))
    .limit(100);

  return NextResponse.json(rows);
}
