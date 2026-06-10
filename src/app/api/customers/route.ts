import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { parseListParams, likePattern } from "@/lib/services/list-query";
import { createCustomerSchema } from "@/lib/validations";
import { createCustomer } from "@/lib/services/customer";
import { emitEvent } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

// GET /api/customers?workspaceId=...&status=active — list a workspace's customers
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const status = url.searchParams.get("status");
    const lq = parseListParams(url);
    const conds = [eq(customers.workspaceId, workspaceId)];
    if (status) conds.push(eq(customers.status, status as "active" | "inactive"));
    if (lq.q) conds.push(or(ilike(customers.name, likePattern(lq.q)), ilike(customers.email, likePattern(lq.q)))!);

    const base = db.select().from(customers).where(and(...conds)).orderBy(desc(customers.createdAt)).offset(lq.offset);
    const rows = await (lq.limit != null ? base.limit(lq.limit) : base);
    return ok({ data: rows });
  }, { route: "GET /api/customers" });
}

// POST /api/customers — create a customer
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createCustomerSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const customer = await createCustomer(input.workspaceId, input, session.user.id);

    await emitEvent(db, {
      workspaceId: input.workspaceId,
      eventType: "customer.created",
      aggregateType: "customer",
      aggregateId: customer.id,
      actorUserId: session.user.id,
      payload: { name: customer.name },
    });
    dispatchInline();

    return created(customer);
  }, { route: "POST /api/customers" });
}
