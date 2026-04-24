import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { columns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// POST /api/boards/[id]/columns — add a column
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: boardId } = await params;

  const { name, type, config } = await request.json();

  if (!name?.trim() || !type) {
    return NextResponse.json({ error: "Name and type are required" }, { status: 400 });
  }

  // Get max position
  const existing = await db
    .select({ position: columns.position })
    .from(columns)
    .where(eq(columns.boardId, boardId))
    .orderBy(columns.position);

  const maxPos = existing.length > 0 ? existing[existing.length - 1].position : 0;

  // Default configs for certain types
  let columnConfig = config || {};
  if (type === "status" && !config) {
    columnConfig = {
      labels: [
        { id: "1", text: "Working on it", color: "#fdab3d" },
        { id: "2", text: "Done", color: "#00c875" },
        { id: "3", text: "Stuck", color: "#e2445c" },
        { id: "4", text: "Not started", color: "#c4c4c4" },
      ],
    };
  }
  if (type === "priority" && !config) {
    columnConfig = {
      labels: [
        { id: "1", text: "Critical", color: "#333333" },
        { id: "2", text: "High", color: "#401694" },
        { id: "3", text: "Medium", color: "#5559df" },
        { id: "4", text: "Low", color: "#579bfc" },
      ],
    };
  }
  if (type === "dropdown" && !config) {
    columnConfig = {
      labels: [
        { id: "1", text: "Option 1", color: "#579bfc" },
        { id: "2", text: "Option 2", color: "#00c875" },
        { id: "3", text: "Option 3", color: "#fdab3d" },
      ],
    };
  }

  const [column] = await db
    .insert(columns)
    .values({
      boardId,
      name: name.trim(),
      type,
      position: maxPos + 1,
      config: columnConfig,
    })
    .returning();

  return NextResponse.json(column, { status: 201 });
}
