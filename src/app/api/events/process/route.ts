import { NextResponse } from "next/server";
import { dispatchPending } from "@/lib/events/dispatcher";

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

  const result = await dispatchPending(100);
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
