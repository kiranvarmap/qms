import { db } from "@/lib/db";
import { portalContacts, customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized } from "@/lib/api";
import { getPortalSession } from "@/lib/services/portal-auth";

// GET /api/portal/me — the logged-in portal contact + its customer.
export async function GET() {
  return apiHandler(async () => {
    const session = await getPortalSession();
    if (!session) return unauthorized();

    const [contact] = await db
      .select({ id: portalContacts.id, name: portalContacts.name, email: portalContacts.email })
      .from(portalContacts)
      .where(eq(portalContacts.id, session.contactId))
      .limit(1);
    if (!contact) return unauthorized();

    const [customer] = await db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(eq(customers.id, session.customerId))
      .limit(1);

    return ok({ contact, customer: customer ?? null });
  }, { route: "GET /api/portal/me" });
}
