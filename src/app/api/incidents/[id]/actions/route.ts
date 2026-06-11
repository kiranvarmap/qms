import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { incidents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { addSafetyActionSchema, safetyActionStatusSchema } from "@/lib/validations";
import { addAction, setActionStatus } from "@/lib/services/safety";

async function guard(id: string, userId: string, role?: string) {
  const [inc] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
  if (!inc) return { error: "not_found" as const };
  if (!(await hasModuleAccess(inc.workspaceId, userId, "canAccessHR", role))) return { error: "forbidden" as const };
  return { workspaceId: inc.workspaceId };
}

// POST /api/incidents/[id]/actions — add a corrective action
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const input = addSafetyActionSchema.parse(await req.json());
    return created(await addAction(g.workspaceId, id, input.description, input.dueDate));
  }, { route: "POST /api/incidents/[id]/actions" });
}

// PATCH /api/incidents/[id]/actions — toggle an action open/done
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const { actionId, status } = safetyActionStatusSchema.parse(await req.json());
    return ok(await setActionStatus(g.workspaceId, actionId, status));
  }, { route: "PATCH /api/incidents/[id]/actions" });
}
