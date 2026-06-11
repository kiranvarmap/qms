import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { webhookSubscriptions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(120).trim().optional(),
  url: z.string().url().optional(),
  eventTypes: z.array(z.string().max(100)).max(50).optional(),
  isActive: z.boolean().optional(),
});

async function loadAndGate(id: string, userId: string, role: string) {
  const [sub] = await db.select().from(webhookSubscriptions).where(eq(webhookSubscriptions.id, id)).limit(1);
  if (!sub) return { sub: null, allowed: false };
  const allowed = role === "admin" || (await canAdminWorkspace(sub.workspaceId, userId));
  return { sub, allowed };
}

// PATCH /api/webhooks/[id] — re-activating resets the failure counter.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const { sub, allowed } = await loadAndGate(id, session.user.id, session.user.role);
    if (!sub) return notFound();
    if (!allowed) return forbidden();

    const patch = patchSchema.parse(await req.json());
    const [updated] = await db
      .update(webhookSubscriptions)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.url !== undefined ? { url: patch.url } : {}),
        ...(patch.eventTypes !== undefined ? { eventTypes: patch.eventTypes } : {}),
        ...(patch.isActive !== undefined ? { isActive: patch.isActive, ...(patch.isActive ? { failCount: 0 } : {}) } : {}),
      })
      .where(eq(webhookSubscriptions.id, id))
      .returning({ id: webhookSubscriptions.id, isActive: webhookSubscriptions.isActive });
    return ok(updated);
  }, { route: "PATCH /api/webhooks/[id]" });
}

// DELETE /api/webhooks/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const { sub, allowed } = await loadAndGate(id, session.user.id, session.user.role);
    if (!sub) return notFound();
    if (!allowed) return forbidden();

    await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, id));
    return noContent();
  }, { route: "DELETE /api/webhooks/[id]" });
}
