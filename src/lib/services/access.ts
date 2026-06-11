/**
 * Workspace access guards (Plan §1.3 / §13 tenant isolation).
 *
 * Shared membership + module-flag checks so every business-ops route gates on
 * the same `workspaceMembers` permission model. A global `admin` bypasses
 * module flags; workspace `owner`/`admin` roles are treated as full-access.
 */

import { db } from "@/lib/db";
import { workspaceMembers, memberPermissionSets, permissionSetEntries } from "@/lib/db/schema";
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
/** RBAC v2 module key for each legacy boolean flag. */
const FLAG_MODULE: Record<ModuleFlag, string> = {
  canAccessVendors: "vendors",
  canAccessPurchasing: "purchasing",
  canAccessInventory: "inventory",
  canAccessInvoicing: "invoicing",
  canAccessExpenses: "expenses",
  canAccessHR: "hr",
  canAccessTraining: "training",
};

/** Any permission-set grant (any action) for this module? (RBAC v2 dual-read.) */
async function hasSetGrant(workspaceId: string, userId: string, module: string): Promise<boolean> {
  const [grant] = await db
    .select({ id: permissionSetEntries.id })
    .from(memberPermissionSets)
    .innerJoin(permissionSetEntries, eq(permissionSetEntries.setId, memberPermissionSets.setId))
    .where(
      and(
        eq(memberPermissionSets.workspaceId, workspaceId),
        eq(memberPermissionSets.userId, userId),
        eq(permissionSetEntries.module, module)
      )
    )
    .limit(1);
  return Boolean(grant);
}

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
  if (m[flag]) return true;
  // RBAC v2: a permission-set grant also opens the module (dual-read shim —
  // blueprint 02 §3; booleans become derived/removable once sets are adopted).
  return hasSetGrant(workspaceId, userId, FLAG_MODULE[flag]);
}

/** True when the user can administer the workspace (owner/admin or global admin). */
export async function canAdminWorkspace(workspaceId: string, userId: string, globalRole?: string): Promise<boolean> {
  if (globalRole === "admin") return true;
  const m = await getMembership(workspaceId, userId);
  return m?.role === "owner" || m?.role === "admin";
}
