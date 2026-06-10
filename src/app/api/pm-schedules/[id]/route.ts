import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pmSchedules } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updatePmScheduleSchema } from "@/lib/validations";

async function load(id: string) {
  const [schedule] = await db.select().from(pmSchedules).where(eq(pmSchedules.id, id)).limit(1);
  return schedule ?? null;
}

// PATCH /api/pm-schedules/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const schedule = await load(id);
    if (!schedule) return notFound();
    if (!(await hasModuleAccess(schedule.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const patch = updatePmScheduleSchema.parse(await req.json());
    const [updated] = await db
      .update(pmSchedules)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.intervalDays !== undefined ? { intervalDays: patch.intervalDays } : {}),
        ...(patch.checklist !== undefined ? { checklist: patch.checklist } : {}),
        ...(patch.nextDue !== undefined ? { nextDue: new Date(patch.nextDue) } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      })
      .where(eq(pmSchedules.id, id))
      .returning();

    return ok(updated);
  }, { route: "PATCH /api/pm-schedules/[id]" });
}

// DELETE /api/pm-schedules/[id] — deactivating (PATCH isActive:false) is usually
// better; delete is for plans created in error.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const schedule = await load(id);
    if (!schedule) return notFound();
    if (!(await hasModuleAccess(schedule.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    await db.delete(pmSchedules).where(eq(pmSchedules.id, id));
    return noContent();
  }, { route: "DELETE /api/pm-schedules/[id]" });
}
