import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { vendors } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, created, noContent, unauthorized, notFound, forbidden, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { vendorDocumentSchema } from "@/lib/validations";
import { addDocument, deleteDocument } from "@/lib/services/vendor-extended";

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
    const input = vendorDocumentSchema.parse(await req.json());
    return created(await addDocument(g.workspaceId, id, input));
  }, { route: "POST /api/vendors/[id]/documents" });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const g = await guard(id, session.user.id, session.user.role);
    if (g.error === "not_found") return notFound();
    if (g.error === "forbidden") return forbidden();
    const docId = new URL(req.url).searchParams.get("id");
    if (!docId) return badRequest("id required");
    await deleteDocument(g.workspaceId, docId);
    return noContent();
  }, { route: "DELETE /api/vendors/[id]/documents" });
}
