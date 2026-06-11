import { db } from "@/lib/db";
import { portalContacts } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { apiHandler, ok, badRequest, unauthorized } from "@/lib/api";
import { portalLoginSchema } from "@/lib/validations";
import { verifyPortalPassword, setPortalSession } from "@/lib/services/portal-auth";

// POST /api/portal/auth/login — portal contact login (separate from staff auth).
export async function POST(req: Request) {
  return apiHandler(async () => {
    const parsed = portalLoginSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Invalid credentials");
    const { email, password } = parsed.data;

    const [contact] = await db
      .select()
      .from(portalContacts)
      .where(and(eq(portalContacts.email, email), eq(portalContacts.status, "active")))
      .limit(1);

    // Constant-ish failure path — don't reveal whether the email exists.
    if (!contact) return unauthorized("Invalid email or password");
    const valid = await verifyPortalPassword(password, contact.passwordHash);
    if (!valid) return unauthorized("Invalid email or password");

    await db.update(portalContacts).set({ lastLoginAt: new Date() }).where(eq(portalContacts.id, contact.id));
    await setPortalSession({ contactId: contact.id, customerId: contact.customerId, workspaceId: contact.workspaceId });

    return ok({ name: contact.name, email: contact.email });
  }, { route: "POST /api/portal/auth/login" });
}
