import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pmSchedules, assets } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden, notFound } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createPmScheduleSchema } from "@/lib/validations";

// GET /api/pm-schedules?workspaceId=...&assetId=... — preventive-maintenance plans
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const assetId = url.searchParams.get("assetId");
    const conds = [eq(pmSchedules.workspaceId, workspaceId)];
    if (assetId) conds.push(eq(pmSchedules.assetId, assetId));

    const rows = await db
      .select({
        schedule: pmSchedules,
        assetName: assets.name,
        assetCode: assets.code,
      })
      .from(pmSchedules)
      .leftJoin(assets, eq(assets.id, pmSchedules.assetId))
      .where(and(...conds))
      .orderBy(desc(pmSchedules.createdAt));

    return ok({ data: rows.map((r) => ({ ...r.schedule, assetName: r.assetName, assetCode: r.assetCode })) });
  }, { route: "GET /api/pm-schedules" });
}

// POST /api/pm-schedules — create a plan; the events cron generates orders at nextDue
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createPmScheduleSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();

    const [asset] = await db
      .select({ id: assets.id })
      .from(assets)
      .where(and(eq(assets.id, input.assetId), eq(assets.workspaceId, input.workspaceId)))
      .limit(1);
    if (!asset) return notFound();

    const [schedule] = await db
      .insert(pmSchedules)
      .values({
        workspaceId: input.workspaceId,
        assetId: input.assetId,
        name: input.name,
        intervalDays: input.intervalDays,
        checklist: input.checklist || null,
        nextDue: new Date(input.nextDue),
      })
      .returning();

    return created(schedule);
  }, { route: "POST /api/pm-schedules" });
}
