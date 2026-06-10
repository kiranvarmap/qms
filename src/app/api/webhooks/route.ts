import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { webhookSubscriptions } from "@/lib/db/schema";
import { desc, eq } from "drizzle-orm";
import { apiHandler, ok, created, unauthorized, badRequest, forbidden } from "@/lib/api";
import { canAdminWorkspace } from "@/lib/services/access";
import { z } from "zod";

const createWebhookSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(120).trim(),
  url: z.string().url().refine((u) => u.startsWith("https://") || u.startsWith("http://localhost"), {
    message: "Webhook URLs must be https (or localhost for development)",
  }),
  eventTypes: z.array(z.string().max(100)).max(50).default([]),
});

async function adminGate(workspaceId: string, userId: string, role: string) {
  return role === "admin" || (await canAdminWorkspace(workspaceId, userId));
}

// GET /api/webhooks?workspaceId= — list subscriptions (secret never returned)
export async function GET(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const workspaceId = new URL(req.url).searchParams.get("workspaceId");
    if (!workspaceId) return badRequest("workspaceId required");
    if (!(await adminGate(workspaceId, session.user.id, session.user.role))) return forbidden();

    const rows = await db
      .select({
        id: webhookSubscriptions.id,
        name: webhookSubscriptions.name,
        url: webhookSubscriptions.url,
        eventTypes: webhookSubscriptions.eventTypes,
        isActive: webhookSubscriptions.isActive,
        failCount: webhookSubscriptions.failCount,
        lastStatus: webhookSubscriptions.lastStatus,
        lastDeliveredAt: webhookSubscriptions.lastDeliveredAt,
        createdAt: webhookSubscriptions.createdAt,
      })
      .from(webhookSubscriptions)
      .where(eq(webhookSubscriptions.workspaceId, workspaceId))
      .orderBy(desc(webhookSubscriptions.createdAt));
    return ok({ data: rows });
  }, { route: "GET /api/webhooks" });
}

// POST /api/webhooks — create; the signing secret is returned ONCE.
export async function POST(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const input = createWebhookSchema.parse(await req.json());
    if (!(await adminGate(input.workspaceId, session.user.id, session.user.role))) return forbidden();

    const secret = randomBytes(32).toString("hex");
    const [row] = await db
      .insert(webhookSubscriptions)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        url: input.url,
        secret,
        eventTypes: input.eventTypes,
        createdBy: session.user.id,
      })
      .returning({ id: webhookSubscriptions.id, name: webhookSubscriptions.name, url: webhookSubscriptions.url });
    // The only time the secret leaves the server — store it on the receiver.
    return created({ ...row, secret });
  }, { route: "POST /api/webhooks" });
}
