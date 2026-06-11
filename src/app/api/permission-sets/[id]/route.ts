import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { permissionSets, memberPermissionSets, workspaceMembers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { apiHandler, ok, noContent, unauthorized, notFound, forbidden, badRequest } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { z } from "zod";

const assignSchema = z.object({
  // Replace the full assignee list for this set.
  userIds: z.array(z.string().uuid()).max(500),
});

async function loadAndGate(id: string, userId: string, role: string) {
  const [set] = await db.select().from(permissionSets).where(eq(permissionSets.id, id)).limit(1);
  if (!set) return { set: null, allowed: false };
  const allowed = role === "admin" || (await canAdminWorkspace(set.workspaceId, userId));
  return { set, allowed };
}

// PUT /api/permission-sets/[id] — replace member assignments
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const { set, allowed } = await loadAndGate(id, session.user.id, session.user.role);
    if (!set) return notFound();
    if (!allowed) return forbidden();

    const { userIds } = assignSchema.parse(await req.json());
    // Assignees must be members of the workspace.
    for (const uid of userIds) {
      const [m] = await db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, set.workspaceId), eq(workspaceMembers.userId, uid)))
        .limit(1);
      if (!m) return badRequest(`User ${uid} is not a member of this workspace`);
    }

    await db.transaction(async (tx) => {
      await tx.delete(memberPermissionSets).where(eq(memberPermissionSets.setId, id));
      for (const uid of userIds) {
        await tx
          .insert(memberPermissionSets)
          .values({ workspaceId: set.workspaceId, userId: uid, setId: id })
          .onConflictDoNothing();
      }
    });
    return ok({ id, assigned: userIds.length });
  }, { route: "PUT /api/permission-sets/[id]" });
}

// DELETE /api/permission-sets/[id] — entries and assignments cascade
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;
    const { set, allowed } = await loadAndGate(id, session.user.id, session.user.role);
    if (!set) return notFound();
    if (!allowed) return forbidden();

    await db.delete(permissionSets).where(eq(permissionSets.id, id));
    return noContent();
  }, { route: "DELETE /api/permission-sets/[id]" });
}
