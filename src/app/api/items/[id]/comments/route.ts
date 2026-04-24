import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { comments, items, boards, users, notifications, workspaceMembers } from "@/lib/db/schema";
import { eq, desc, and, inArray } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/items/[id]/comments
export async function GET(_req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: itemId } = await params;

  const rows = await db
    .select({
      id: comments.id,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      mentionedUserIds: comments.mentionedUserIds,
      userId: comments.userId,
      userName: users.name,
      userImage: users.image,
    })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.itemId, itemId))
    .orderBy(comments.createdAt);

  return NextResponse.json(rows);
}

// POST /api/items/[id]/comments
export async function POST(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: itemId } = await params;

  const { content } = await req.json();
  if (!content?.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  // Fetch item to get boardId
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });

  // Parse @mentions: format @[name](userId)
  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]+)\)/g;
  const mentionedUserIds: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentionedUserIds.push(match[2]);
  }

  const [comment] = await db
    .insert(comments)
    .values({
      itemId,
      boardId: item.boardId,
      userId: session.user.id,
      content: content.trim(),
      mentionedUserIds,
    })
    .returning();

  // Fetch commenter name for notification body
  const [commenter] = await db.select({ name: users.name }).from(users).where(eq(users.id, session.user.id)).limit(1);

  // Notify mentioned users
  if (mentionedUserIds.length > 0) {
    const uniqueIds = [...new Set(mentionedUserIds)].filter((id) => id !== session.user.id);
    if (uniqueIds.length > 0) {
      await db.insert(notifications).values(
        uniqueIds.map((userId) => ({
          userId,
          type: "comment_mention" as const,
          title: `${commenter?.name ?? "Someone"} mentioned you`,
          body: `In item "${item.name}": ${content.slice(0, 100)}`,
          boardId: item.boardId,
          itemId,
          meta: { commentId: comment.id },
        }))
      );
    }
  }

  return NextResponse.json(comment, { status: 201 });
}
