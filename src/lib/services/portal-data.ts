/**
 * Portal data access (Plan §6.5 / §13).
 *
 * Every loader is filtered by the portal session's customerId + workspaceId and
 * the artifact's `customerVisible` flag (default-deny). Shared so all portal
 * routes enforce the same isolation.
 */

import { db } from "@/lib/db";
import { estimates, invoices } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { PortalSession } from "./portal-auth";

export async function loadScopedEstimate(id: string, s: PortalSession) {
  const [est] = await db
    .select()
    .from(estimates)
    .where(
      and(
        eq(estimates.id, id),
        eq(estimates.workspaceId, s.workspaceId),
        eq(estimates.customerId, s.customerId),
        eq(estimates.customerVisible, true)
      )
    )
    .limit(1);
  return est ?? null;
}

export async function loadScopedInvoice(id: string, s: PortalSession) {
  const [inv] = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.id, id),
        eq(invoices.workspaceId, s.workspaceId),
        eq(invoices.customerId, s.customerId),
        eq(invoices.customerVisible, true)
      )
    )
    .limit(1);
  return inv ?? null;
}
