import { db } from "@/lib/db";
import { statusNotifications, users } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { sendEmail, buildStatusNotificationHtml } from "@/lib/email";

export async function triggerStatusNotifications({
  boardId,
  columnId,
  newValue,
  itemName,
  boardName,
  columnName,
  changedByName,
}: {
  boardId: string;
  columnId: string;
  newValue: string;
  itemName: string;
  boardName: string;
  columnName: string;
  changedByName: string;
}) {
  const rules = await db
    .select()
    .from(statusNotifications)
    .where(
      and(
        eq(statusNotifications.boardId, boardId),
        eq(statusNotifications.columnId, columnId),
        eq(statusNotifications.triggerValue, newValue),
        eq(statusNotifications.isActive, true)
      )
    );

  if (rules.length === 0) return;

  for (const rule of rules) {
    const userIds = rule.notifyUserIds as string[];
    if (!userIds.length) continue;

    const recipients = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(inArray(users.id, userIds));

    const emails = recipients.map((u) => u.email).filter(Boolean) as string[];
    if (!emails.length) continue;

    const subject =
      rule.emailSubject ?? `Status changed to "${newValue}" — ${boardName}`;
    const html = buildStatusNotificationHtml({
      itemName,
      boardName,
      columnName,
      newStatus: newValue,
      changedByName,
    });
    await sendEmail({ to: emails, subject, html });
  }
}
