import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { permissionSets, permissionSetEntries, memberPermissionSets } from "@/lib/db/schema";
import { asc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { z } from "zod";

const MODULES = [
  "boards", "inspections", "docsign", "timeclock",
  "vendors", "purchasing", "inventory", "invoicing",
  "expenses", "hr", "training",
] as const;

const createSetSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(120).trim(),
  description: z.string().max(500).trim().optional(),
  entries: z
    .array(z.object({ module: z.enum(MODULES), action: z.enum(["view", "create", "edit", "approve", "admin"]) }))
    .min(1)
    .max(60),
});

async function adminGate(workspaceId: string, userId: string, role: string) {
  return role === "admin" || (await canAdminWorkspace(workspaceId, userId));
}

// GET /api/permission-sets?workspaceId= — sets with entries + member counts
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await adminGate(workspaceId, session.user.id, session.user.role))) return forbidden();

    const sets = await db
      .select()
      .from(permissionSets)
      .where(eq(permissionSets.workspaceId, workspaceId))
      .orderBy(asc(permissionSets.name));
    const result = [];
    for (const set of sets) {
      const entries = await db.select().from(permissionSetEntries).where(eq(permissionSetEntries.setId, set.id));
      const members = await db.select({ userId: memberPermissionSets.userId }).from(memberPermissionSets).where(eq(memberPermissionSets.setId, set.id));
      result.push({ ...set, entries, memberCount: members.length, memberIds: members.map((m) => m.userId) });
    }
    return ok({ data: result });
  }, { route: "GET /api/permission-sets" });
}

// POST /api/permission-sets — create a named bundle of module × action grants
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createSetSchema.parse(await req.json());
    if (!(await adminGate(input.workspaceId, session.user.id, session.user.role))) return forbidden();

    const set = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(permissionSets)
        .values({
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description ?? null,
          createdBy: session.user.id,
        })
        .returning();
      for (const e of input.entries) {
        await tx.insert(permissionSetEntries).values({ setId: row.id, module: e.module, action: e.action }).onConflictDoNothing();
      }
      return row;
    });
    return created(set);
  }, { route: "POST /api/permission-sets" });
}
