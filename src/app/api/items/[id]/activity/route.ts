import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getActivityFeed } from "@/lib/services/activity";

// GET /api/items/[id]/activity — the 360° task timeline (Plan B.5.2/B.5.4).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const feed = await getActivityFeed("item", id);
  return NextResponse.json({ data: feed });
}
