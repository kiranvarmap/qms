import { auth } from "@/lib/auth";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createIncidentSchema } from "@/lib/validations";
import { listIncidents, createIncident } from "@/lib/services/safety";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/incidents?workspaceId=...
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();
    return ok({ data: await listIncidents(workspaceId) });
  }, { route: "GET /api/incidents" });
}

// POST /api/incidents — report an incident / near-miss
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createIncidentSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessHR", session.user.role)))
      return forbidden();
    const inc = await createIncident(input.workspaceId, input, session.user.id);
    dispatchInline();
    return created(inc);
  }, { route: "POST /api/incidents" });
}
