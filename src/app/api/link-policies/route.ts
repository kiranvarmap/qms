import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { linkPolicies, workspaceMembers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

// Admin governance for the scope ladder, per workspace × module (Plan B.4.2).

const MODULES = ["inspection", "time_clock", "sign", "form"] as const;
const LEVELS = ["none", "workspace", "board", "group", "item"] as const;

const upsertSchema = z.object({
  workspaceId: z.string().uuid(),
  module: z.enum(MODULES),
  mode: z.enum(["disabled", "optional", "required"]).default("optional"),
  allowGeneral: z.boolean().default(true),
  minLevel: z.enum(LEVELS).default("none"),
  maxLevel: z.enum(LEVELS).default("item"),
  rungRules: z.array(z.record(z.string(), z.unknown())).default([]),
  defaultTarget: z.record(z.string(), z.unknown()).nullable().optional(),
  isActive: z.boolean().default(true),
});

async function canAdminWorkspace(workspaceId: string, userId: string, globalRole?: string) {
  if (globalRole === "admin") return true;
  const [m] = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return m?.role === "owner" || m?.role === "admin";
}

// GET /api/link-policies?workspaceId=...  → all policies for a workspace
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const workspaceId = new URL(req.url).searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const rows = await db.select().from(linkPolicies).where(eq(linkPolicies.workspaceId, workspaceId));
  return NextResponse.json({ data: rows });
}

// PUT /api/link-policies  → upsert one policy (admin / workspace owner only)
export async function PUT(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = upsertSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid policy", details: parsed.error.flatten() }, { status: 400 });
  }
  const p = parsed.data;

  if (!(await canAdminWorkspace(p.workspaceId, session.user.id, session.user.role))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [row] = await db
    .insert(linkPolicies)
    .values({
      workspaceId: p.workspaceId,
      module: p.module,
      mode: p.mode,
      allowGeneral: p.allowGeneral,
      minLevel: p.minLevel,
      maxLevel: p.maxLevel,
      rungRules: p.rungRules,
      defaultTarget: p.defaultTarget ?? null,
      isActive: p.isActive,
      updatedBy: session.user.id,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [linkPolicies.workspaceId, linkPolicies.module],
      set: {
        mode: p.mode,
        allowGeneral: p.allowGeneral,
        minLevel: p.minLevel,
        maxLevel: p.maxLevel,
        rungRules: p.rungRules,
        defaultTarget: p.defaultTarget ?? null,
        isActive: p.isActive,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    })
    .returning();

  return NextResponse.json(row);
}
