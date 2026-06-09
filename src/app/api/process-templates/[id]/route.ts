import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { processTemplates } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateProcessTemplateSchema } from "@/lib/validations";
import { getTemplate, updateTemplate, deleteTemplate } from "@/lib/services/production-planning";

async function tpl(id: string) {
  const [row] = await db.select().from(processTemplates).where(eq(processTemplates.id, id)).limit(1);
  return row ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const row = await tpl(id);
    if (!row) return notFound();
    if (!(await hasModuleAccess(row.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    return ok(await getTemplate(row.workspaceId, id));
  }, { route: "GET /api/process-templates/[id]" });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const row = await tpl(id);
    if (!row) return notFound();
    if (!(await hasModuleAccess(row.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const patch = updateProcessTemplateSchema.parse(await req.json());
    return ok(await updateTemplate(row.workspaceId, id, patch));
  }, { route: "PATCH /api/process-templates/[id]" });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const row = await tpl(id);
    if (!row) return notFound();
    if (!(await hasModuleAccess(row.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    await deleteTemplate(row.workspaceId, id);
    return noContent();
  }, { route: "DELETE /api/process-templates/[id]" });
}
