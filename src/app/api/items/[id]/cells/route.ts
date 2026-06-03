import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cellValues, items, columns, boards, users, notifications } from "@/lib/db/schema";
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

    // ── In-app notifications: assignment (person) + status change (owner) ──
    void createCellNotifications({
      itemId, columnId, jsonValue, effectiveValue, actorId: session.user.id,
    }).catch(() => {});

    return NextResponse.json({ itemId, columnId, ...data });
  } catch (err) {
    console.error("[PUT /api/items/[id]/cells]", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

// Create in-app notifications for a cell change:
//  • person column set → notify the assignee ("you were assigned")
//  • status column changed → notify the item owner
async function createCellNotifications(args: {
  itemId: string; columnId: string; jsonValue: unknown; effectiveValue: string | null; actorId: string;
}) {
  const { itemId, columnId, jsonValue, effectiveValue, actorId } = args;
  const [col] = await db.select({ type: columns.type }).from(columns).where(eq(columns.id, columnId)).limit(1);
  const [itm] = await db.select({ name: items.name, createdBy: items.createdBy, boardId: items.boardId })
    .from(items).where(eq(items.id, itemId)).limit(1);
  if (!col || !itm) return;

  if (col.type === "person" && jsonValue && typeof jsonValue === "object") {
    const assignee = (jsonValue as { userId?: string }).userId;
    if (assignee && assignee !== actorId) {
      await db.insert(notifications).values({
        userId: assignee,
        type: "item_assigned",
        title: "You were assigned",
        body: `You were assigned to "${itm.name}"`,
        boardId: itm.boardId, itemId, meta: {},
      });
    }
  }

  if (col.type === "status" && effectiveValue && itm.createdBy && itm.createdBy !== actorId) {
    await db.insert(notifications).values({
      userId: itm.createdBy,
      type: "status_changed",
      title: "Status updated",
      body: `"${itm.name}" → ${effectiveValue}`,
      boardId: itm.boardId, itemId, meta: {},
    });
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

