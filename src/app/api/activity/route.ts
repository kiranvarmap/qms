import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActivityFeed, type FeedLevel } from "@/lib/services/activity";

// GET /api/activity?level=board&id=...  — board / workspace roll-up feed (Plan B.5.3).
export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const level = (searchParams.get("level") ?? "workspace") as FeedLevel;
  const id = searchParams.get("id");
  if (!id || !["item", "board", "workspace"].includes(level)) {
    return NextResponse.json({ error: "level (item|board|workspace) and id are required" }, { status: 400 });
  }

  const feed = await getActivityFeed(level, id);
  return NextResponse.json({ data: feed });
}
