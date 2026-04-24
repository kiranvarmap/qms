import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { boards, groups, columns, items, cellValues } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type Params = { params: Promise<{ id: string }> };

// GET /api/boards/[id]/export?format=csv
export async function GET(req: Request, { params }: Params) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id: boardId } = await params;

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "csv";

  const [board] = await db.select().from(boards).where(eq(boards.id, boardId)).limit(1);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  const boardGroups = await db.select().from(groups).where(eq(groups.boardId, boardId)).orderBy(groups.position);
  const boardColumns = await db.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(columns.position);
  const boardItems = await db.select().from(items).where(eq(items.boardId, boardId)).orderBy(items.position);
  const cells = await db.select().from(cellValues).where(
    // Fetch all cells for items in this board
    eq(cellValues.itemId, boardItems[0]?.id ?? "")
  );

  // Build a map: itemId → columnId → CellValue
  // More efficient: fetch all cells for all items
  const allCells = boardItems.length > 0
    ? await db.select().from(cellValues)
        // We can't easily do `in` on itemId without importing inArray, 
        // but let's use a raw approach via the item IDs
        .where(
          eq(cellValues.itemId, boardItems.map((i) => i.id).join(","))
        )
    : [];

  // Build cell map using individual queries - use a different approach
  const cellMap: Record<string, Record<string, typeof cells[0]>> = {};

  // Fetch cells for all items
  for (const item of boardItems) {
    const itemCells = await db
      .select()
      .from(cellValues)
      .where(eq(cellValues.itemId, item.id));
    cellMap[item.id] = {};
    for (const cell of itemCells) {
      cellMap[item.id][cell.columnId] = cell;
    }
  }

  // Build groups map
  const groupMap: Record<string, string> = {};
  for (const g of boardGroups) {
    groupMap[g.id] = g.name;
  }

  // Build CSV
  const headers = ["Group", "Item", ...boardColumns.map((c) => c.name)];

  const escapeCsv = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  function cellToString(cell: typeof cells[0] | undefined, colType: string): string {
    if (!cell) return "";
    if (cell.textValue !== null) return cell.textValue;
    if (cell.numberValue !== null) return String(cell.numberValue);
    if (cell.booleanValue !== null) return cell.booleanValue ? "Yes" : "No";
    if (cell.dateValue !== null) return new Date(cell.dateValue).toLocaleDateString();
    if (cell.jsonValue !== null) {
      if (Array.isArray(cell.jsonValue)) {
        return (cell.jsonValue as Array<{ name?: string; label?: string }>)
          .map((v) => v?.name ?? v?.label ?? String(v))
          .join(", ");
      }
      return JSON.stringify(cell.jsonValue);
    }
    return "";
  }

  const rows = boardItems.map((item) => {
    const group = groupMap[item.groupId] ?? "";
    const values = boardColumns.map((col) => {
      const cell = cellMap[item.id]?.[col.id];
      return escapeCsv(cellToString(cell, col.type));
    });
    return [escapeCsv(group), escapeCsv(item.name), ...values].join(",");
  });

  const csv = [
    headers.map(escapeCsv).join(","),
    ...rows,
  ].join("\n");

  const filename = `${board.name.replace(/[^a-z0-9]/gi, "_")}_export.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
