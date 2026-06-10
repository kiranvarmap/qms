import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { attachments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { deleteFromStorage } from "@/lib/storage";
import { logger } from "@/lib/logger";

// DELETE /api/attachments/[id] — uploader or a workspace admin only.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [row] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
    if (!row) return notFound();

    const isUploader = row.uploadedBy === session.user.id;
    const isAdmin = session.user.role === "admin" || (await canAdminWorkspace(row.workspaceId, session.user.id));
    if (!isUploader && !isAdmin) return forbidden();

    await db.delete(attachments).where(eq(attachments.id, id));
    // Best effort — a dangling object is preferable to a failing delete.
    await deleteFromStorage(row.fileKey).catch((err) =>
      logger.warn("attachment storage delete failed", { id, error: String(err) })
    );
    return noContent();
  }, { route: "DELETE /api/attachments/[id]" });
}
