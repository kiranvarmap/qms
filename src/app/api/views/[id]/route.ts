import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { savedViews } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";

// DELETE /api/views/[id] — owner (or workspace admin for shared views) only.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [view] = await db.select().from(savedViews).where(eq(savedViews.id, id)).limit(1);
    if (!view) return notFound();

    const isOwner = view.userId === session.user.id;
    const isAdmin = session.user.role === "admin" || (await canAdminWorkspace(view.workspaceId, session.user.id));
    if (!isOwner && !isAdmin) return forbidden();

    await db.delete(savedViews).where(eq(savedViews.id, id));
    return noContent();
  }, { route: "DELETE /api/views/[id]" });
}
