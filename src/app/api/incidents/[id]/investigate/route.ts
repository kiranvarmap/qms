import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { incidents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { investigateIncidentSchema } from "@/lib/validations";
import { startInvestigation } from "@/lib/services/safety";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/incidents/[id]/investigate — assign self as investigator, set root cause
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [inc] = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
    if (!inc) return notFound();
    if (!(await hasModuleAccess(inc.workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();
    const { rootCause } = investigateIncidentSchema.parse(await req.json().catch(() => ({})));
    const updated = await startInvestigation(inc.workspaceId, id, rootCause, session.user.id);
    dispatchInline();
    return ok(updated);
  }, { route: "POST /api/incidents/[id]/investigate" });
}
