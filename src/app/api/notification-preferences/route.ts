import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { notificationPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized } from "@/lib/api";
import { z } from "zod";

const putSchema = z.object({
  preferences: z
    .array(
      z.object({
        eventType: z.string().min(1).max(100),
        inApp: z.boolean(),
        email: z.boolean(),
      })
    )
    .max(100),
});

// GET /api/notification-preferences — the caller's per-event delivery choices.
export async function GET() {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const rows = await db
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, session.user.id));
    return ok({ data: rows });
  }, { route: "GET /api/notification-preferences" });
}

// PUT /api/notification-preferences — upsert the caller's choices in bulk.
export async function PUT(req: Request) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { preferences } = putSchema.parse(await req.json());

    for (const p of preferences) {
      await db
        .insert(notificationPreferences)
        .values({ userId: session.user.id, eventType: p.eventType, inApp: p.inApp, email: p.email })
        .onConflictDoUpdate({
          target: [notificationPreferences.userId, notificationPreferences.eventType],
          set: { inApp: p.inApp, email: p.email },
        });
    }
    return ok({ saved: preferences.length });
  }, { route: "PUT /api/notification-preferences" });
}
