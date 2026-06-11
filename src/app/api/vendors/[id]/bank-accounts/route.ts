import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, created, noContent, unauthorized, notFound, forbidden, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { vendorBankAccountSchema } from "@/lib/validations";
import { addBankAccount, verifyBankAccount, deleteBankAccount } from "@/lib/services/vendor-extended";

async function guard(id: string, userId: string, role?: string) {
  const [v] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!v) return { error: "not_found" as const };
  if (!(await hasModuleAccess(v.workspaceId, userId, "canAccessVendors", role))) return { error: "forbidden" as const };
  return { workspaceId: v.workspaceId };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const input = vendorBankAccountSchema.parse(await req.json());
    return created(await addBankAccount(g.workspaceId, id, input));
  }, { route: "POST /api/vendors/[id]/bank-accounts" });
}

// PATCH ?id=... — mark verified (bank-change control)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const acctId = new URL(req.url).searchParams.get("id");
    if (!acctId) return badRequest("id required");
    return ok(await verifyBankAccount(g.workspaceId, acctId));
  }, { route: "PATCH /api/vendors/[id]/bank-accounts" });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const acctId = new URL(req.url).searchParams.get("id");
    if (!acctId) return badRequest("id required");
    await deleteBankAccount(g.workspaceId, acctId);
    return noContent();
  }, { route: "DELETE /api/vendors/[id]/bank-accounts" });
}
