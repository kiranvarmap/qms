import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimates, estimateLineItems, estimateVersions } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";

// POST /api/estimates/[id]/revise — snapshot the current revision into
// estimate_versions, bump the version, and reopen the estimate as a draft so
// it can be edited and re-sent. Conversion ends the line — a converted
// estimate cannot be revised.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [est] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
    if (!est) return notFound();
    if (!(await hasModuleAccess(est.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (est.status === "converted") return conflict("A converted estimate cannot be revised");

    const result = await db.transaction(async (tx) => {
      const lines = await tx
        .select()
        .from(estimateLineItems)
        .where(eq(estimateLineItems.estimateId, id))
        .orderBy(asc(estimateLineItems.position));

      await tx
        .insert(estimateVersions)
        .values({
          estimateId: id,
          version: est.version,
          snapshot: {
            status: est.status,
            subtotalMinor: est.subtotalMinor,
            taxMinor: est.taxMinor,
            totalMinor: est.totalMinor,
            validUntil: est.validUntil,
            lines,
          },
          createdBy: session.user.id,
        })
        .onConflictDoNothing();

      const nextVersion = est.version + 1;
      await tx
        .update(estimates)
        .set({ version: nextVersion, status: "draft", acceptedAt: null, sentAt: null, updatedAt: new Date() })
        .where(eq(estimates.id, id));
      return { version: nextVersion };
    });

    return ok({ id, status: "draft", version: result.version });
  }, { route: "POST /api/estimates/[id]/revise" });
}
