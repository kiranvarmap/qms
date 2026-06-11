import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workCenters } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { workCenterShiftsSchema } from "@/lib/validations";
import { getWorkCenter, setWorkCenterShifts } from "@/lib/services/production-planning";

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
    return ok({ data: full?.shifts ?? [] });
  }, { route: "GET /api/work-centers/[id]/shifts" });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const row = await wc(id);
    if (!row) return notFound();
    if (!(await hasModuleAccess(row.workspaceId, session.user.id, "canAccessInventory", session.user.role))) return forbidden();
    const { shifts } = workCenterShiftsSchema.parse(await req.json());
    return ok({ data: await setWorkCenterShifts(id, shifts) });
  }, { route: "PUT /api/work-centers/[id]/shifts" });
}
