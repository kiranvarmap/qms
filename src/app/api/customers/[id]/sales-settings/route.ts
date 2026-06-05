import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { customerSalesSettingsSchema } from "@/lib/validations";
import { setCustomerSalesSettings } from "@/lib/services/sales-extended";

// POST /api/customers/[id]/sales-settings — set credit limit + default price list
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [c] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
    if (!c) return notFound();
    if (!(await hasModuleAccess(c.workspaceId, session.user.id, "canAccessInvoicing", session.user.role))) return forbidden();
    const input = customerSalesSettingsSchema.parse(await req.json());
    return ok(await setCustomerSalesSettings(c.workspaceId, id, input));
  }, { route: "POST /api/customers/[id]/sales-settings" });
}
