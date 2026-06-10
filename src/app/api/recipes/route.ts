import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { eventRecipes } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { z } from "zod";

const createRecipeSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(160).trim(),
  eventType: z.string().min(3).max(100),
  actionType: z.enum(["notify_admins", "notify_user", "create_task"]),
  config: z
    .object({
      userId: z.string().uuid().optional(),
      boardId: z.string().uuid().optional(),
      groupName: z.string().max(120).optional(),
      titleTemplate: z.string().max(300).optional(),
    })
    .default({}),
})
  .refine((r) => r.actionType !== "notify_user" || Boolean(r.config.userId), {
    message: "notify_user requires config.userId",
  })
  .refine((r) => r.actionType !== "create_task" || Boolean(r.config.boardId), {
    message: "create_task requires config.boardId",
  });

async function adminGate(workspaceId: string, userId: string, role: string) {
  return role === "admin" || (await canAdminWorkspace(workspaceId, userId));
}

// GET /api/recipes?workspaceId= — "when ⟨event⟩ then ⟨action⟩" automations
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await adminGate(workspaceId, session.user.id, session.user.role))) return forbidden();

    const rows = await db
      .select()
      .from(eventRecipes)
      .where(eq(eventRecipes.workspaceId, workspaceId))
      .orderBy(desc(eventRecipes.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/recipes" });
}

// POST /api/recipes
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createRecipeSchema.parse(await req.json());
    if (!(await adminGate(input.workspaceId, session.user.id, session.user.role))) return forbidden();

    const [row] = await db
      .insert(eventRecipes)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        eventType: input.eventType,
        actionType: input.actionType,
        config: input.config,
        createdBy: session.user.id,
      })
      .returning();
    return created(row);
  }, { route: "POST /api/recipes" });
}
