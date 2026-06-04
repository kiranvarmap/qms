import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { estimates, estimateLineItems, estimateVersions, customers } from "@/lib/db/schema";
import { asc, desc, eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { updateEstimateSchema } from "@/lib/validations";
import { writeEstimateLinesAndTotals } from "@/lib/services/estimates";

async function load(id: string) {
  const [estimate] = await db.select().from(estimates).where(eq(estimates.id, id)).limit(1);
  return estimate ?? null;
}

// GET /api/estimates/[id] — estimate with lines, customer, version history
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const estimate = await load(id);
    if (!estimate) return notFound();
    if (!(await hasModuleAccess(estimate.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();

    const [lines, versions, [customer]] = await Promise.all([
      db.select().from(estimateLineItems).where(eq(estimateLineItems.estimateId, id)).orderBy(asc(estimateLineItems.position)),
      db.select().from(estimateVersions).where(eq(estimateVersions.estimateId, id)).orderBy(desc(estimateVersions.version)),
      db.select().from(customers).where(eq(customers.id, estimate.customerId)).limit(1),
    ]);

    return ok({ ...estimate, customer: customer ?? null, lines, versions });
  }, { route: "GET /api/estimates/[id]" });
}

// PATCH /api/estimates/[id] — edit a draft estimate only
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const estimate = await load(id);
    if (!estimate) return notFound();
    if (!(await hasModuleAccess(estimate.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (estimate.status !== "draft") return conflict("Only draft estimates can be edited");

    const patch = updateEstimateSchema.parse(await req.json());
    if (patch.customerId && patch.customerId !== estimate.customerId) {
      const [c] = await db.select().from(customers).where(eq(customers.id, patch.customerId)).limit(1);
      if (!c || c.workspaceId !== estimate.workspaceId) return badRequest("Invalid customer");
    }

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(estimates)
        .set({
          ...(patch.customerId !== undefined ? { customerId: patch.customerId } : {}),
          ...(patch.validUntil !== undefined ? { validUntil: patch.validUntil ? new Date(patch.validUntil) : null } : {}),
          ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          updatedAt: new Date(),
        })
        .where(eq(estimates.id, id))
        .returning();
      if (patch.lines) await writeEstimateLinesAndTotals(tx, estimate.workspaceId, id, patch.lines);
      return row;
    });

    return ok(updated);
  }, { route: "PATCH /api/estimates/[id]" });
}

// DELETE /api/estimates/[id] — draft / rejected / expired only
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const estimate = await load(id);
    if (!estimate) return notFound();
    if (!(await hasModuleAccess(estimate.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (!["draft", "rejected", "expired"].includes(estimate.status))
      return conflict("Only draft, rejected, or expired estimates can be deleted");

    await db.delete(estimates).where(eq(estimates.id, id));
    return noContent();
  }, { route: "DELETE /api/estimates/[id]" });
}
