import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { incidents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { getIncident } from "@/lib/services/safety";

// GET /api/incidents/[id] — incident with its corrective actions
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [inc] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (!inc) return notFound();
    if (!(await hasModuleAccess(inc.workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();
    return ok(await getIncident(inc.workspaceId, id));
  }, { route: "GET /api/incidents/[id]" });
}
