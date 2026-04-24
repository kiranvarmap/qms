import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cellValues, items, columns, boards, users } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { triggerStatusNotifications } from "@/lib/notifications";
import { runAutomations } from "@/lib/automations";

// PUT /api/items/[id]/cells — upsert a cell value
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id: itemId } = await params;

    const { columnId, textValue, numberValue, booleanValue, dateValue, jsonValue } =
      await request.json();

    if (!columnId) {
      return NextResponse.json({ error: "columnId is required" }, { status: 400 });
    }

    // Check if cell exists
    const [existing] = await db
      .select()
      .from(cellValues)
      .where(
        and(eq(cellValues.itemId, itemId), eq(cellValues.columnId, columnId))
      )
      .limit(1);

    const data = {
      textValue: textValue ?? null,
      numberValue: numberValue ?? null,
      booleanValue: booleanValue ?? null,
      dateValue: dateValue ? new Date(dateValue) : null,
      jsonValue: jsonValue ?? null,
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(cellValues)
        .set(data)
        .where(
          and(eq(cellValues.itemId, itemId), eq(cellValues.columnId, columnId))
        );
    } else {
      await db.insert(cellValues).values({
        itemId,
        columnId,
        ...data,
      });
    }

    // ── Trigger status-change notifications async ──────────────────────
    // status/priority/dropdown cells store the option as { id, text, color }
    // some integrations use { label } — support both
    const jsonObj = typeof jsonValue === "object" && jsonValue !== null ? jsonValue as Record<string, unknown> : null;
    const effectiveValue =
      textValue ??
      (jsonObj ? ((jsonObj.text as string) ?? (jsonObj.label as string) ?? null) : null) ??
      (typeof jsonValue === "string" ? jsonValue : null);

    if (effectiveValue) {
      void triggerNotificationsForCell(itemId, columnId, effectiveValue, session.user.id).catch(() => {});
      const [itemRow] = await db.select({ boardId: items.boardId }).from(items).where(eq(items.id, itemId)).limit(1);
      if (itemRow) {
        void runAutomations({
          type: "column_changed",
          boardId: itemRow.boardId,
          itemId,
          columnId,
          newValue: effectiveValue,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ itemId, columnId, ...data });
  } catch (err) {
    console.error("[PUT /api/items/[id]/cells]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

async function triggerNotificationsForCell(
  itemId: string,
  columnId: string,
  newValue: string,
  changedById: string
) {
  try {
    const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
    if (!item) return;

    const [column] = await db.select().from(columns).where(eq(columns.id, columnId)).limit(1);
    if (!column || !["status", "dropdown"].includes(column.type)) return;

    const [board] = await db.select().from(boards).where(eq(boards.id, item.boardId)).limit(1);
    if (!board) return;

    const [changer] = await db.select({ name: users.name }).from(users).where(eq(users.id, changedById)).limit(1);

    await triggerStatusNotifications({
      boardId: board.id,
      columnId,
      newValue,
      itemName: item.name,
      boardName: board.name,
      columnName: column.name,
      changedByName: changer?.name ?? "Unknown",
    });
  } catch {
    // Silently ignore notification errors
  }
}

