import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { portalContacts, customers } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { createPortalContactSchema } from "@/lib/validations";
import { hashPortalPassword } from "@/lib/services/portal-auth";

// Staff-side management of customer-portal logins (Plan §6.5). Gated on
// canAccessInvoicing. Portal contacts are NOT workspace members.

// GET /api/portal-contacts?workspaceId=...&customerId= — list (no hashes)
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await hasModuleAccess(workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const customerId = url.searchParams.get("customerId");
    const conds = [eq(portalContacts.workspaceId, workspaceId)];
    if (customerId) conds.push(eq(portalContacts.customerId, customerId));

    const rows = await db
      .select({
        id: portalContacts.id,
        customerId: portalContacts.customerId,
        name: portalContacts.name,
        email: portalContacts.email,
        status: portalContacts.status,
        lastLoginAt: portalContacts.lastLoginAt,
        createdAt: portalContacts.createdAt,
      })
      .from(portalContacts)
      .where(and(...conds))
      .orderBy(desc(portalContacts.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/portal-contacts" });
}

// POST /api/portal-contacts — create a portal login for a customer
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();

    const input = createPortalContactSchema.parse(await req.json());
    if (!(await hasModuleAccess(input.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const [customer] = await db.select().from(customers).where(eq(customers.id, input.customerId)).limit(1);
    if (!customer || customer.workspaceId !== input.workspaceId) return badRequest("Invalid customer");

    const [existing] = await db
      .select({ id: portalContacts.id })
      .from(portalContacts)
      .where(and(eq(portalContacts.workspaceId, input.workspaceId), eq(portalContacts.email, input.email)))
      .limit(1);
    if (existing) return conflict("A portal contact with this email already exists");

    const passwordHash = await hashPortalPassword(input.password);
    const [contact] = await db
      .insert(portalContacts)
      .values({
        workspaceId: input.workspaceId,
        customerId: input.customerId,
        name: input.name,
        email: input.email,
        passwordHash,
        createdBy: session.user.id,
      })
      .returning({
        id: portalContacts.id,
        customerId: portalContacts.customerId,
        name: portalContacts.name,
        email: portalContacts.email,
        status: portalContacts.status,
      });

    return created(contact);
  }, { route: "POST /api/portal-contacts" });
}
