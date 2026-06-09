import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workCenters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { workCenterMachinesSchema } from "@/lib/validations";
import { getWorkCenter, setWorkCenterMachines } from "@/lib/services/production-planning";

async function wc(id: string) {
  const [row] = await db.select().from(workCenters).where(eq(workCenters.id, id)).limit(1);
  return row ?? null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const row = await wc(id);
    if (!row) return notFound();
    if (!(await hasModuleAccess(row.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const full = await getWorkCenter(row.workspaceId, id);
    return ok({ data: full?.machines ?? [] });
  }, { route: "GET /api/work-centers/[id]/machines" });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const row = await wc(id);
    if (!row) return notFound();
    if (!(await hasModuleAccess(row.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const { machines } = workCenterMachinesSchema.parse(await req.json());
    return ok({ data: await setWorkCenterMachines(row.workspaceId, id, machines) });
  }, { route: "PUT /api/work-centers/[id]/machines" });
}
