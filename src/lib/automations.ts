/**
 * Automation Engine
 *
 * runAutomations() is called after relevant events (column_changed, item_created, form_submitted).
 * Date-based automations (date_reached) are checked via a scheduled cron or on-demand fetch.
 */

import { db } from "@/lib/db";
import {
  automations,
  automationLogs,
  items,
  cellValues,
  columns,
  groups,
  notifications,
  users,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sendEmail } from "@/lib/email";

export type AutomationTrigger =
  | { type: "column_changed"; boardId: string; itemId: string; columnId: string; newValue: string }
  | { type: "item_created"; boardId: string; itemId: string }
  | { type: "form_submitted"; boardId: string; itemId: string; formId: string };

export async function runAutomations(trigger: AutomationTrigger) {
  // Fetch active automations for this board matching trigger type
  const boardAutomations = await db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.boardId, trigger.boardId),
        eq(automations.isActive, true),
        eq(automations.triggerType, trigger.type)
      )
    );

  for (const automation of boardAutomations) {
    const config = automation.triggerConfig as Record<string, unknown>;

    // ── Evaluate trigger conditions ─────────────────────────────
    let shouldRun = false;

    if (trigger.type === "column_changed") {
      const colMatch = !config.columnId || config.columnId === trigger.columnId;
      const valMatch = !config.toValue || config.toValue === trigger.newValue;
      shouldRun = colMatch && valMatch;
    } else if (trigger.type === "item_created" || trigger.type === "form_submitted") {
      if (trigger.type === "form_submitted") {
        shouldRun = !config.formId || config.formId === trigger.formId;
      } else {
        shouldRun = true;
      }
    }

    if (!shouldRun) continue;

    // ── Execute action ──────────────────────────────────────────
    try {
      await executeAction(automation, trigger.itemId, trigger);
      await db.insert(automationLogs).values({
        automationId: automation.id,
        itemId: trigger.itemId,
        status: "success",
        details: { trigger },
      });
    } catch (err: unknown) {
      await db.insert(automationLogs).values({
        automationId: automation.id,
        itemId: trigger.itemId,
        status: "error",
        details: { trigger, error: err instanceof Error ? err.message : String(err) },
      });
    }
  }
}

// ── Action executor ─────────────────────────────────────────────────

// Write a value string to the correct DB column field based on column type
async function applyFieldChange(itemId: string, columnId: string, value: string) {
  const [col] = await db
    .select({ type: columns.type, config: columns.config })
    .from(columns)
    .where(eq(columns.id, columnId))
    .limit(1);
  const colType = col?.type ?? "text";

  // Build the typed update payload
  const data: {
    textValue?: string | null;
    numberValue?: number | null;
    booleanValue?: boolean | null;
    dateValue?: Date | null;
    jsonValue?: unknown;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (colType === "number") {
    data.numberValue = value === "" ? null : Number(value);
  } else if (colType === "checkbox") {
    data.booleanValue = value === "true" || value === "1";
  } else if (colType === "date") {
    if (value === "today") {
      data.dateValue = new Date();
    } else if (/^[+-]\d+$/.test(value)) {
      const d = new Date();
      d.setDate(d.getDate() + Number(value));
      data.dateValue = d;
    } else {
      data.dateValue = value ? new Date(value) : null;
    }
  } else if (["status", "priority", "dropdown"].includes(colType)) {
    // These columns display from jsonValue: { id, text, color }
    // Look up the label by text in the column config
    type Label = { id: string; text: string; color?: string };
    const labels = ((col?.config as { labels?: Label[] }) ?? {}).labels ?? [];
    const label = labels.find((l) => l.text === value);
    if (label) {
      data.jsonValue = { id: label.id, text: label.text, color: label.color ?? null };
    } else {
      // Unknown label text — store as plain text fallback
      data.textValue = value;
    }
  } else {
    // text, link, formula, rating, person — stored as textValue
    data.textValue = value;
  }

  const existing = await db
    .select({ itemId: cellValues.itemId })
    .from(cellValues)
    .where(and(eq(cellValues.itemId, itemId), eq(cellValues.columnId, columnId)))
    .limit(1);

  if (existing.length > 0) {
    await db.update(cellValues).set(data).where(
      and(eq(cellValues.itemId, itemId), eq(cellValues.columnId, columnId))
    );
  } else {
    await db.insert(cellValues).values({ itemId, columnId, ...data });
  }
}

async function executeAction(
  automation: typeof automations.$inferSelect,
  itemId: string,
  triggerCtx?: AutomationTrigger
) {
  const cfg = automation.actionConfig as Record<string, unknown>;

  switch (automation.actionType) {
    case "notify_user": {
      // UI saves userId (singular); support legacy userIds (array) too
      const userId = cfg.userId as string | undefined;
      const userIds = userId ? [userId] : ((cfg.userIds as string[]) ?? []);
      const message = (cfg.message as string) ?? automation.name;
      if (userIds.length > 0) {
        const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
        await db.insert(notifications).values(
          userIds.map((userId) => ({
            userId,
            type: "automation_triggered",
            title: automation.name,
            body: `${message}${item ? ` — Item: ${item.name}` : ""}`,
            boardId: automation.boardId,
            itemId,
            meta: { automationId: automation.id },
          }))
        );
      }
      break;
    }

    case "send_email": {
      const to = cfg.to as string;
      const subject = (cfg.subject as string) ?? automation.name;
      const body = (cfg.body as string) ?? "";
      if (to) {
        await sendEmail({ to, subject, html: `<p>${body}</p>` });
      }
      break;
    }

    case "move_to_group": {
      const targetGroupId = cfg.groupId as string;
      if (targetGroupId) {
        const [group] = await db.select().from(groups).where(eq(groups.id, targetGroupId)).limit(1);
        if (group) {
          await db.update(items).set({ groupId: targetGroupId }).where(eq(items.id, itemId));
        }
      }
      break;
    }

    case "change_field": {
      // ── Flat mode: { fieldChanges: [{columnId, value}] } ──────────────────
      // Used when trigger has a specific toValue (e.g. "when Priority = Low")
      if (Array.isArray(cfg.fieldChanges)) {
        for (const chg of cfg.fieldChanges as { columnId: string; value: string }[]) {
          if (chg.columnId) {
            await applyFieldChange(itemId, chg.columnId, chg.value ?? "");
          }
        }
        break;
      }

      // ── Per-value rules mode: { sourceColumnId, valueRules: [{whenValue, fieldChanges}] } ──
      // Used when trigger fires on any change; the matching rule is selected by newValue
      if (Array.isArray(cfg.valueRules)) {
        const newValue =
          triggerCtx?.type === "column_changed" ? triggerCtx.newValue : "";
        const matchedRule = (cfg.valueRules as { whenValue: string; fieldChanges: { columnId: string; value: string }[] }[])
          .find(r => r.whenValue === newValue);
        if (matchedRule) {
          for (const chg of matchedRule.fieldChanges) {
            if (chg.columnId) {
              await applyFieldChange(itemId, chg.columnId, chg.value ?? "");
            }
          }
        }
        break;
      }

      // ── Legacy fallback: { columnId, value } ─────────────────────────────
      const columnId = cfg.columnId as string;
      const value = (cfg.value as string) ?? "";
      if (columnId) {
        await applyFieldChange(itemId, columnId, value);
      }
      break;
    }

    case "set_date": {
      const columnId = cfg.columnId as string;
      const offsetDays = (cfg.offsetDays as number) ?? 0;
      if (columnId) {
        const date = new Date();
        date.setDate(date.getDate() + offsetDays);
        const existing = await db
          .select()
          .from(cellValues)
          .where(and(eq(cellValues.itemId, itemId), eq(cellValues.columnId, columnId)))
          .limit(1);
        const data = { dateValue: date, updatedAt: new Date() };
        if (existing.length > 0) {
          await db.update(cellValues).set(data).where(
            and(eq(cellValues.itemId, itemId), eq(cellValues.columnId, columnId))
          );
        } else {
          await db.insert(cellValues).values({ itemId, columnId, ...data });
        }
      }
      break;
    }

    case "archive_item": {
      // Soft-archive by moving to a group named "Archived" (or just append to name)
      // For now update the item name with [Archived] prefix
      const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
      if (item && !item.name.startsWith("[Archived]")) {
        await db
          .update(items)
          .set({ name: `[Archived] ${item.name}`, updatedAt: new Date() })
          .where(eq(items.id, itemId));
      }
      break;
    }
  }
}

/**
 * Run date-reached automations across all boards.
 * Call this from a cron/scheduled route.
 */
export async function runDateAutomations() {
  const dateAutomations = await db
    .select()
    .from(automations)
    .where(and(eq(automations.triggerType, "date_reached"), eq(automations.isActive, true)));

  for (const automation of dateAutomations) {
    const cfg = automation.triggerConfig as Record<string, unknown>;
    const columnId = cfg.columnId as string;
    const offsetDays = (cfg.offsetDays as number) ?? 0;

    if (!columnId) continue;

    // Get all items on this board that have this date column set
    const cells = await db
      .select({ itemId: cellValues.itemId, dateValue: cellValues.dateValue })
      .from(cellValues)
      .where(eq(cellValues.columnId, columnId));

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const cell of cells) {
      if (!cell.dateValue) continue;
      const target = new Date(cell.dateValue);
      target.setDate(target.getDate() - offsetDays);
      target.setHours(0, 0, 0, 0);
      if (target.getTime() === today.getTime()) {
        try {
          await executeAction(automation, cell.itemId);
          await db.insert(automationLogs).values({
            automationId: automation.id,
            itemId: cell.itemId,
            status: "success",
            details: { trigger: { type: "date_reached", columnId, offsetDays } },
          });
        } catch (err: unknown) {
          await db.insert(automationLogs).values({
            automationId: automation.id,
            itemId: cell.itemId,
            status: "error",
            details: { error: err instanceof Error ? err.message : String(err) },
          });
        }
      }
    }
  }
}
