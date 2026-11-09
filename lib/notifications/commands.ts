import { z } from "zod";
import type { RecordRow } from "@/lib/activity/client";
export const notificationCommandSchema = z.object({ recordId: z.uuid(), expenseId: z.string().min(1).nullable(), enabled: z.boolean(), muted: z.boolean(), stopped: z.boolean(), snoozedUntil: z.iso.datetime().nullable(), dueAt: z.iso.datetime().nullable() });
export type NotificationCommand = z.infer<typeof notificationCommandSchema>;
export type NotificationPreference = NotificationCommand & { revision: number };
export type ReviewedNotification = NotificationCommand & { expected: number };
export function prepareNotificationCommands(rows: RecordRow[], email: string, commands: NotificationCommand[], preferences: NotificationPreference[]) {
  const seen = new Set<string>();
  return commands.map(raw => {
    const command = notificationCommandSchema.parse(raw);
    const key = `${command.recordId}:${command.expenseId ?? "invitation"}`;
    if (seen.has(key)) throw Error("Review each notification task once.");
    seen.add(key);
    const row = rows.find(r => r.document.id === command.recordId);
    if (!row || !row.document.people.some(p => p.email === email)) throw Error("Notification task unavailable.");
    if (command.expenseId === null && row.kind !== "group") throw Error("Choose a group invitation or an expense.");
    if (command.expenseId !== null) {
      if (row.kind !== "activity") throw Error("Choose an expense.");
      const expense = row.document.expenses.find(e => e.id === command.expenseId);
      if (!expense) throw Error("Expense unavailable.");
      if (command.enabled && !command.dueAt && !expense.dueDate) throw Error("When should the first reminder be due?");
    }
    return { ...command, expected: preferences.find(p => p.recordId === command.recordId && p.expenseId === command.expenseId)?.revision ?? 0 };
  });
}
