import { apiHandler, ok } from "@/lib/api";
import { clearPortalSession } from "@/lib/services/portal-auth";

// POST /api/portal/auth/logout — clear the portal session cookie.
export async function POST() {
  return apiHandler(async () => {
    await clearPortalSession();
    return ok({ ok: true });
  }, { route: "POST /api/portal/auth/logout" });
}
