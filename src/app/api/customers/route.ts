import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createCustomerSchema } from "@/lib/validations";

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
    const where = status
      ? and(eq(customers.workspaceId, workspaceId), eq(customers.status, status as "active" | "inactive"))
      : eq(customers.workspaceId, workspaceId);

    const rows = await db.select().from(customers).where(where).orderBy(desc(customers.createdAt));
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

    const [customer] = await db
      .insert(customers)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        code: input.code || null,
        email: input.email || null,
        phone: input.phone || null,
        taxId: input.taxId || null,
        billingAddress: input.billingAddress ?? {},
        shippingAddress: input.shippingAddress ?? {},
        paymentTermsDays: input.paymentTermsDays ?? 30,
        accountManagerEmployeeId: input.accountManagerEmployeeId || null,
        boardId: input.boardId || null,
        notes: input.notes || null,
        createdBy: session.user.id,
      })
      .returning();

    return created(customer);
  }, { route: "POST /api/customers" });
}
