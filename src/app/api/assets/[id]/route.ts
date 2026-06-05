import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { assetStatusSchema } from "@/lib/validations";
import { setAssetStatus } from "@/lib/services/maintenance";
import { dispatchInline } from "@/lib/events/dispatcher";

async function load(id: string) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id)).limit(1);
  return asset ?? null;
}

// GET /api/assets/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const asset = await load(id);
    if (!asset) return notFound();
    if (!(await hasModuleAccess(asset.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    return ok(asset);
  }, { route: "GET /api/assets/[id]" });
}

// PATCH /api/assets/[id] — change asset status (up/down/maintenance/retired)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const asset = await load(id);
    if (!asset) return notFound();
    if (!(await hasModuleAccess(asset.workspaceId, session.user.id, "canAccessInventory", session.user.role)))
      return forbidden();
    const { status } = assetStatusSchema.parse(await req.json());
    const updated = await setAssetStatus(asset.workspaceId, id, status, session.user.id);
    dispatchInline();
    return ok(updated);
  }, { route: "PATCH /api/assets/[id]" });
}
