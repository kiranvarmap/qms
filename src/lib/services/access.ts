/**
 * Workspace access guards (Plan §1.3 / §13 tenant isolation).
 *
 * Shared membership + module-flag checks so every business-ops route gates on
 * the same `workspaceMembers` permission model. A global `admin` bypasses
 * module flags; workspace `owner`/`admin` roles are treated as full-access.
 */

import { db } from "@/lib/db";
import { workspaceMembers } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type ModuleFlag =
  | "canAccessVendors"
  | "canAccessPurchasing"
  | "canAccessInventory"
  | "canAccessInvoicing"
  | "canAccessExpenses"
  | "canAccessHR"
  | "canAccessTraining";

export type Membership = typeof workspaceMembers.$inferSelect;

/** The member row for (workspace × user), or null if not a member. */
export async function getMembership(workspaceId: string, userId: string): Promise<Membership | null> {
  const [m] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1);
  return m ?? null;
}

/**
 * True when the user may use `flag` in this workspace. Global admins and
 * workspace owners/admins always pass; otherwise the boolean flag must be set.
 */
export async function hasModuleAccess(
  workspaceId: string,
  userId: string,
  flag: ModuleFlag,
  globalRole?: string
): Promise<boolean> {
  if (globalRole === "admin") return true;
  const m = await getMembership(workspaceId, userId);
  if (!m) return false;
  if (m.role === "owner" || m.role === "admin") return true;
  return Boolean(m[flag]);
}

/** True when the user can administer the workspace (owner/admin or global admin). */
export async function canAdminWorkspace(workspaceId: string, userId: string, globalRole?: string): Promise<boolean> {
  if (globalRole === "admin") return true;
  const m = await getMembership(workspaceId, userId);
  return m?.role === "owner" || m?.role === "admin";
}
