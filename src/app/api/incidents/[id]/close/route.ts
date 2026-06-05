import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { incidents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { closeIncident } from "@/lib/services/safety";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/incidents/[id]/close — close the incident
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [inc] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (!inc) return notFound();
    if (!(await hasModuleAccess(inc.workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();
    if (inc.status === "closed") return conflict("Incident already closed");
    const updated = await closeIncident(inc.workspaceId, id, session.user.id);
    dispatchInline();
    return ok(updated);
  }, { route: "POST /api/incidents/[id]/close" });
}
