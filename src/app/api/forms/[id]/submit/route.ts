import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { forms, formFields, columns, items, cellValues, groups, boards } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { runAutomations } from "@/lib/automations";
import { emitEventStandalone } from "@/lib/events/outbox";
import { dispatchInline } from "@/lib/events/dispatcher";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/forms/[id]/submit
 * Public endpoint — creates a board item from the submitted form data.
 * No authentication required for public forms.
 */
export async function POST(req: Request, { params }: Params) {
  const { id: formId } = await params;

  const [form] = await db.select().from(forms).where(eq(forms.id, formId)).limit(1);
  if (!form || !form.isActive) {
    return NextResponse.json({ error: "Form not found or inactive" }, { status: 404 });
  }

  const body = await req.json() as Record<string, unknown>;

  // Fetch form fields ordered by position
  const fields = await db
    .select()
    .from(formFields)
    .where(eq(formFields.formId, formId))
    .orderBy(asc(formFields.position));

  // Validate required fields
  for (const field of fields) {
    if (field.isRequired && field.isVisible) {
      const val = body[field.id];
      if (val === undefined || val === null || val === "") {
        return NextResponse.json(
          { error: `Field "${field.label}" is required` },
          { status: 400 }
        );
      }
    }
  }

  // Determine item name: use the "Name" field (columnId = null), or the body["name"] key,
  // or fall back to an auto-generated timestamp name so the form always submits successfully.
  const nameField = fields.find((f) => f.columnId === null);
  const rawName = (nameField ? body[nameField.id] : body["name"]) as string | undefined;
  const itemName = rawName?.trim() ||
    `Form Submission – ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;

  // Find the first (or default) group in this board
  const [firstGroup] = await db
    .select()
    .from(groups)
    .where(eq(groups.boardId, form.boardId))
    .orderBy(groups.position)
    .limit(1);

  if (!firstGroup) {
    return NextResponse.json({ error: "Board has no groups" }, { status: 500 });
  }

  // Get existing items count for position
  const existingItems = await db
    .select({ position: items.position })
    .from(items)
    .where(eq(items.groupId, firstGroup.id))
    .orderBy(items.position);

  const maxPos = existingItems.length > 0 ? existingItems[existingItems.length - 1].position : 0;

  // We need a system user — use the board creator's ID or a null-safe fallback
  // For public submissions there's no session, so we need the board's owner or a system approach.
  // We'll use the form's createdBy as the item author.
  // Denormalize the tenant onto the item (Plan D.4.3) so cross-module
  // queries and the activity feed carry full ancestry.
  const [board] = await db
    .select({ workspaceId: boards.workspaceId })
    .from(boards)
    .where(eq(boards.id, form.boardId))
    .limit(1);

  const [item] = await db
    .insert(items)
    .values({
      boardId: form.boardId,
      groupId: firstGroup.id,
      workspaceId: board?.workspaceId ?? null,
      name: itemName,
      position: maxPos + 1,
      createdBy: form.createdBy,
    })
    .returning();

  // Save cell values for each field that has a columnId
  const columnFields = fields.filter((f) => f.columnId !== null && f.isVisible);

  for (const field of columnFields) {
    const value = body[field.id];
    if (value === undefined || value === null) continue;

    const [col] = await db
      .select({ type: columns.type })
      .from(columns)
      .where(eq(columns.id, field.columnId!))
      .limit(1);

    if (!col) continue;

    let textValue: string | null = null;
    let numberValue: number | null = null;
    let booleanValue: boolean | null = null;
    let dateValue: Date | null = null;
    let jsonValue: unknown = null;

    switch (col.type) {
      case "text":
      case "link":
        textValue = String(value);
        break;
      case "status":
      case "dropdown":
      case "priority": {
        // Look up the full label object so the board renders properly
        const [colWithConfig] = await db
          .select({ config: columns.config })
          .from(columns)
          .where(eq(columns.id, field.columnId!))
          .limit(1);
        type LabelCfg = { labels?: { id: string; text: string; color?: string }[] };
        const cfgLabels = ((colWithConfig?.config as LabelCfg) ?? {}).labels ?? [];
        const matchedLabel = cfgLabels.find(l => l.text === String(value));
        if (matchedLabel) {
          jsonValue = { id: matchedLabel.id, text: matchedLabel.text, color: matchedLabel.color ?? null };
        } else {
          textValue = String(value);
        }
        break;
      }
      case "number":
      case "rating":
        numberValue = Number(value);
        break;
      case "checkbox":
        booleanValue = value === "true" || value === true;
        break;
      case "date":
        dateValue = new Date(value as string);
        break;
      case "person":
        jsonValue = value;
        break;
      default:
        textValue = String(value);
    }

    await db.insert(cellValues).values({
      itemId: item.id,
      columnId: field.columnId!,
      textValue,
      numberValue,
      booleanValue,
      dateValue,
      jsonValue,
    });
  }

  // Fire form_submitted automations (board-scoped rules engine)
  void runAutomations({
    type: "form_submitted",
    boardId: form.boardId,
    itemId: item.id,
    formId: form.id,
  }).catch(() => {});

  // Intake Loop (Plan E.2 #3): record on the unified event bus + activity feed.
  void emitEventStandalone({
    workspaceId: board?.workspaceId ?? null,
    eventType: "form.submitted",
    aggregateType: "form",
    aggregateId: form.id,
    payload: { boardId: form.boardId, itemId: item.id, summary: `Form "${form.name}" submitted` },
  })
    .then(() => dispatchInline())
    .catch(() => {});

  return NextResponse.json({
    ok: true,
    itemId: item.id,
    message: form.submitMessage,
  });
}
