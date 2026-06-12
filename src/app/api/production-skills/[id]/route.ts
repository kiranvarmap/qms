import { auth } from "@/lib/auth";
import { apiHandler, ok, noContent, unauthorized, badRequest, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateProductionSkillSchema } from "@/lib/validations";
import { updateSkill, deleteSkill } from "@/lib/services/production-planning";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const patch = updateProductionSkillSchema.parse(await req.json());
    const row = await updateSkill(workspaceId, id, patch);
    if (!row) return notFound();
    return ok({ data: row });
  }, { route: "PATCH /api/production-skills/[id]" });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const row = await deleteSkill(workspaceId, id);
    if (!row) return notFound();
    return noContent();
  }, { route: "DELETE /api/production-skills/[id]" });
}
