import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { salesOrders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiHandler, ok, unauthorized, notFound, forbidden, conflict, badRequest } from "@/lib/api";
import { hasModuleAccess } from "@/lib/services/access";
import { reserveAndApproveSalesOrder } from "@/lib/services/sales-orders";
import { creditCheck } from "@/lib/services/sales-extended";
import { dispatchInline } from "@/lib/events/dispatcher";

// POST /api/sales-orders/[id]/approve — approve and RESERVE stock (Plan §6.3):
// each tracked line raises `committed` (available drops) without touching
// on-hand. On-hand only leaves at shipment. Pass ?override=true to bypass a
// customer credit-limit breach (Sales full BRD). Orders routed through the
// approval engine instead use /submit; this direct path covers workspaces
// without an approval policy.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return apiHandler(async () => {
    const session = await auth();
    if (!session) return unauthorized();
    const { id } = await params;

    const [so] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
    if (!so) return notFound();
    if (!(await hasModuleAccess(so.workspaceId, session.user.id, "canAccessInvoicing", session.user.role)))
      return forbidden();
    if (so.status !== "draft" && so.status !== "pending_approval")
      return conflict("Only draft sales orders can be approved");

    // Credit-limit check (skippable with ?override=true).
    if (new URL(req.url).searchParams.get("override") !== "true") {
      const credit = await creditCheck(so.workspaceId, so.customerId, so.totalMinor);
      if (!credit.ok)
        return conflict(`Credit limit exceeded: outstanding ${(credit.outstanding / 100).toFixed(2)} + order ${(so.totalMinor / 100).toFixed(2)} > limit ${(credit.limit / 100).toFixed(2)}. Approve with override to proceed.`);
    }

    const result = await reserveAndApproveSalesOrder(so.workspaceId, id, session.user.id);
    if ("error" in result) {
      if (result.error === "not_found") return notFound();
      if (result.error === "warehouse_required")
        return badRequest("Set a warehouse on the order before approving (stock will be reserved from it)");
      return conflict("Sales order changed state; refresh and retry");
    }

    dispatchInline();
    return ok({ id, status: result.status });
  }, { route: "POST /api/sales-orders/[id]/approve" });
}
