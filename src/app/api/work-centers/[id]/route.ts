import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workCenters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateWorkCenterSchema } from "@/lib/validations";
import { getWorkCenter, updateWorkCenter, deleteWorkCenter } from "@/lib/services/production-planning";

async function guard(id: string, role?: string, userId?: string) {
  const [wc] = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);
  if (!wc) return { error: "not_found" as const };
  if (!(await hasModuleAccess(wc.workspaceId, userId!, "canAccessInventory", role))) return { error: "forbidden" as const };
  return { wc };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.role, session.user.id);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    return ok(await getWorkCenter(g.wc.workspaceId, id));
  }, { route: "GET /api/work-centers/[id]" });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.role, session.user.id);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const patch = updateWorkCenterSchema.parse(await req.json());
    return ok(await updateWorkCenter(g.wc.workspaceId, id, patch));
  }, { route: "PATCH /api/work-centers/[id]" });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.role, session.user.id);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    await deleteWorkCenter(g.wc.workspaceId, id);
    return noContent();
  }, { route: "DELETE /api/work-centers/[id]" });
}
