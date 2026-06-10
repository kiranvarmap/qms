import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { boards, savedViews } from "@/lib/db/schema";
import { and, asc, eq, or } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, notFound, badRequest } from "@/lib/api";
import { z } from "zod";

const createViewSchema = z.object({
  name: z.string().min(1).max(120).trim(),
  config: z.record(z.string(), z.unknown()).default({}),
  isShared: z.boolean().optional(),
});

async function loadBoard(id: string) {
  const [b] = await db.select().from(boards).where(eq(boards.id, id)).limit(1);
  return b ?? null;
}

// GET /api/boards/[id]/views — my views + shared views on this board
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const board = await loadBoard(id);
    if (!board) return notFound();

    const rows = await db
      .select()
      .from(savedViews)
      .where(and(eq(savedViews.boardId, id), or(eq(savedViews.userId, session.user.id), eq(savedViews.isShared, true))!))
      .orderBy(asc(savedViews.name));
    return ok({ data: rows });
  }, { route: "GET /api/boards/[id]/views" });
}

// POST /api/boards/[id]/views — save the current view state
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const board = await loadBoard(id);
    if (!board) return notFound();
    if (!board.workspaceId) return badRequest("Board has no workspace");

    const input = createViewSchema.parse(await req.json());
    const [row] = await db
      .insert(savedViews)
      .values({
        workspaceId: board.workspaceId,
        boardId: id,
        userId: session.user.id,
        name: input.name,
        config: input.config,
        isShared: input.isShared ?? false,
      })
      .returning();
    return created(row);
  }, { route: "POST /api/boards/[id]/views" });
}
