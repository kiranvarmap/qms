/**
 * Configurable Linking & Scope Governance — server-side engine (Plan B.4 / D.5b).
 *
 * Every artifact-creating action (start an inspection, clock in, send a doc,
 * submit a form) resolves a position on the universal scope ladder
 *   none → workspace → board → group → item
 * and validates it against the admin-defined `link_policies` row for
 * (workspace × module). This is the ONE mechanism every module shares —
 * no per-feature linking code.
 */

import { db } from "@/lib/db";
import { boards, groups, items, linkPolicies } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export type LinkLevel = "none" | "workspace" | "board" | "group" | "item";
export type LinkModule =
  | "inspection"
  | "time_clock"
  | "sign"
  | "form"
  // ── Business-ops modules (Plan §2.5) — same scope ladder & governance ──
  | "purchase_order"
  | "invoice"
  | "estimate"
  | "sales_order"
  | "expense";

const LEVEL_ORDER: Record<LinkLevel, number> = {
  none: 0,
  workspace: 1,
  board: 2,
  group: 3,
  item: 4,
};

export interface RequestedScope {
  workspaceId: string;
  boardId?: string | null;
  groupId?: string | null;
  itemId?: string | null;
}

export interface ResolvedScope {
  workspaceId: string;
  boardId: string | null;
  groupId: string | null;
  itemId: string | null;
  linkLevel: LinkLevel;
}

interface RungRule {
  level: LinkLevel;
  selection: "locked" | "free" | "predefined";
  options?: string[];
}

export class LinkPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinkPolicyError";
  }
}

/** Read the effective policy, falling back to a permissive default. */
export async function getLinkPolicy(workspaceId: string, module: LinkModule) {
  const [policy] = await db
    .select()
    .from(linkPolicies)
    .where(and(eq(linkPolicies.workspaceId, workspaceId), eq(linkPolicies.module, module)))
    .limit(1);

  return (
    policy ?? {
      workspaceId,
      module,
      mode: "optional" as const,
      allowGeneral: true,
      minLevel: "none" as LinkLevel,
      maxLevel: "item" as LinkLevel,
      rungRules: [] as RungRule[],
      defaultTarget: null,
      isActive: true,
    }
  );
}

/**
 * Resolve the requested scope into a full ancestry, enforcing the policy.
 * Throws LinkPolicyError on any violation. Returns the columns to persist on
 * the artifact (workspaceId always set; deeper rungs null unless chosen).
 */
export async function resolveAndValidateScope(
  module: LinkModule,
  requested: RequestedScope
): Promise<ResolvedScope> {
  const policy = await getLinkPolicy(requested.workspaceId, module);

  if (policy.mode === "disabled") {
    // Linking turned off → everything is general (tenant only).
    return { workspaceId: requested.workspaceId, boardId: null, groupId: null, itemId: null, linkLevel: "none" };
  }

  // Determine the chosen depth from the deepest non-null id.
  let level: LinkLevel = "none";
  if (requested.itemId) level = "item";
  else if (requested.groupId) level = "group";
  else if (requested.boardId) level = "board";
  else if (policy.minLevel !== "none") level = "workspace";

  // ── Mode / general checks ──────────────────────────────────────────
  if (policy.mode === "required" && level === "none") {
    throw new LinkPolicyError(`${module}: linking is required; pick at least ${policy.minLevel}.`);
  }
  // mode is already narrowed to optional|required by the disabled early-return.
  if (level === "none" && !policy.allowGeneral) {
    throw new LinkPolicyError(`${module}: standalone (general) artifacts are not allowed.`);
  }

  // ── Depth bounds ────────────────────────────────────────────────────
  if (level !== "none") {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[policy.minLevel as LinkLevel]) {
      throw new LinkPolicyError(`${module}: must link at least to ${policy.minLevel}.`);
    }
    if (LEVEL_ORDER[level] > LEVEL_ORDER[policy.maxLevel as LinkLevel]) {
      throw new LinkPolicyError(`${module}: may not link deeper than ${policy.maxLevel}.`);
    }
  }

  // ── Resolve & verify ancestry integrity (prevents tampering) ────────
  let boardId = requested.boardId ?? null;
  let groupId = requested.groupId ?? null;
  const itemId = requested.itemId ?? null;

  if (itemId) {
    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    if (!item) throw new LinkPolicyError("Selected item does not exist.");
    if (boardId && boardId !== item.boardId) throw new LinkPolicyError("Item does not belong to the selected board.");
    if (groupId && groupId !== item.groupId) throw new LinkPolicyError("Item does not belong to the selected group.");
    boardId = item.boardId;
    groupId = item.groupId;
  } else if (groupId) {
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
    if (!group) throw new LinkPolicyError("Selected group does not exist.");
    if (boardId && boardId !== group.boardId) throw new LinkPolicyError("Group does not belong to the selected board.");
    boardId = group.boardId;
  }

  if (boardId) {
    const [board] = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
    if (!board) throw new LinkPolicyError("Selected board does not exist.");
    if (board.workspaceId !== requested.workspaceId) {
      throw new LinkPolicyError("Board belongs to a different workspace.");
    }
  }

  // ── Per-rung selection rules (dial #3) ──────────────────────────────
  const rungRules = (policy.rungRules as RungRule[]) ?? [];
  for (const rule of rungRules) {
    const chosen = rule.level === "board" ? boardId : rule.level === "group" ? groupId : rule.level === "item" ? itemId : null;
    if (!chosen) continue;
    if (rule.selection === "predefined" && rule.options && !rule.options.includes(chosen)) {
      throw new LinkPolicyError(`${module}: ${rule.level} must be one of the predefined options.`);
    }
  }

  return { workspaceId: requested.workspaceId, boardId, groupId, itemId, linkLevel: level };
}
