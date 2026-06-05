import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { updateLocalizationSchema } from "@/lib/validations";
import { getCountryPack } from "@/lib/localization";

// GET /api/workspaces/[id]/localization — current profile + resolved country pack
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (!ws) return notFound();
    if (!(await canAdminWorkspace(id, session.user.id, session.user.role))) return forbidden();
    return ok({
      country: ws.country, currency: ws.currency, locale: ws.locale, timezone: ws.timezone,
      pack: getCountryPack(ws.country),
    });
  }, { route: "GET /api/workspaces/[id]/localization" });
}

// PUT /api/workspaces/[id]/localization — set country (pack fills sensible defaults)
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, id)).limit(1);
    if (!ws) return notFound();
    if (!(await canAdminWorkspace(id, session.user.id, session.user.role))) return forbidden();

    const input = updateLocalizationSchema.parse(await req.json());
    const pack = getCountryPack(input.country);
    const [updated] = await db
      .update(workspaces)
      .set({
        country: input.country,
        // Default currency/locale from the pack unless explicitly overridden.
        currency: input.currency ?? pack.currency,
        locale: input.locale ?? pack.locale,
        timezone: input.timezone ?? ws.timezone,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id))
      .returning();

    return ok({
      country: updated.country, currency: updated.currency, locale: updated.locale, timezone: updated.timezone,
      pack: getCountryPack(updated.country),
    });
  }, { route: "PUT /api/workspaces/[id]/localization" });
}
