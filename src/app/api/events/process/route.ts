import { NextResponse } from "next/server";
import { dispatchPending } from "@/lib/events/dispatcher";
import { sweepOverdueInvoices } from "@/lib/services/overdue";
import { sweepCertifications } from "@/lib/services/cert-expiry";
import { sweepExpiredEstimates } from "@/lib/services/estimate-expiry";
import { sweepPmSchedules } from "@/lib/services/pm-generation";
import { sweepApprovalSlas } from "@/lib/services/approval-sla";

// POST/GET /api/events/process — durable outbox sweep (Plan E.3).
// Triggered by Vercel Cron (see vercel.json). Secured with CRON_SECRET:
// Vercel sends `Authorization: Bearer <CRON_SECRET>`. Also callable manually
// with the same header for ops.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Time-based sweeps first (they enqueue events), then drain the outbox.
  const overdue = await sweepOverdueInvoices();
  const certs = await sweepCertifications();
  const estimates = await sweepExpiredEstimates();
  const pm = await sweepPmSchedules();
  const slas = await sweepApprovalSlas();
  const result = await dispatchPending(100);
  return NextResponse.json({
    ok: true,
    ...result,
    overdue: overdue.flagged,
    certsExpiring: certs.expiring,
    estimatesExpired: estimates.expired,
    pmOrdersGenerated: pm.generated,
    approvalsEscalated: slas.escalated,
  });
}

export const GET = handle;
export const POST = handle;
