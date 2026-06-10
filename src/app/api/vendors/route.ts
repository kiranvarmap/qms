import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { parseListParams, likePattern } from "@/lib/services/list-query";
import { createVendorSchema } from "@/lib/validations";
import { createVendor } from "@/lib/services/vendor";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/vendors?workspaceId=...&status=active — list a workspace's vendors
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessVendors", session.user.role)))
      return forbidden();

    const status = url.searchParams.get("status");
    const lq = parseListParams(url);
    const conds = [eq(vendors.workspaceId, workspaceId)];
    if (status) conds.push(eq(vendors.status, status as "active" | "inactive"));
    if (lq.q) conds.push(or(ilike(vendors.name, likePattern(lq.q)), ilike(vendors.code, likePattern(lq.q)))!);

    const base = db.select().from(vendors).where(and(...conds)).orderBy(desc(vendors.createdAt)).offset(lq.offset);
    const rows = await (lq.limit != null ? base.limit(lq.limit) : base);
    return ok({ data: rows });
  }, { route: "GET /api/vendors" });
}

// POST /api/vendors — create a vendor
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createVendorSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessVendors", session.user.role)))
      return forbidden();

    const vendor = await createVendor(input.workspaceId, input, session.user.id);

    await emitEvent(db, {
      workspaceId: input.workspaceId,
      eventType: "vendor.created",
      aggregateType: "vendor",
      aggregateId: vendor.id,
      actorUserId: session.user.id,
      payload: { name: vendor.name },
    });
    dispatchInline();

    return created(vendor);
  }, { route: "POST /api/vendors" });
}
