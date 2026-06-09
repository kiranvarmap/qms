import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateProcessStageSchema } from "@/lib/validations";
import { updateStage, deleteStage } from "@/lib/services/production-planning";

async function tplGuard(id: string, userId: string, role?: string) {
  const [row] = await db.select().from(processTemplates).where(eq(processTemplates.id, id)).limit(1);
  if (!row) return { error: "not_found" as const };
  if (!(await hasModuleAccess(row.workspaceId, userId, "canAccessInventory", role))) return { error: "forbidden" as const };
  return { tpl: row };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id, stageId } = await params;
    const g = await tplGuard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const patch = updateProcessStageSchema.parse(await req.json());
    return ok(await updateStage(stageId, g.tpl.workspaceId, patch));
  }, { route: "PATCH /api/process-templates/[id]/stages/[stageId]" });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id, stageId } = await params;
    const g = await tplGuard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    await deleteStage(stageId);
    return noContent();
  }, { route: "DELETE /api/process-templates/[id]/stages/[stageId]" });
}
