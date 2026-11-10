import type { RecordRow } from "@/lib/activity/client";
import { balances, claimState } from "@/lib/pilot/model";
export function notificationEligible(row: RecordRow | undefined, recipient: string, expenseId: string | null, now: string): boolean {
  if (!row?.document.people.some(p => p.email === recipient)) return false;
  if (expenseId === null) return row.kind === "group" && !row.document.joined.includes(recipient) && Date.parse(row.document.invitations[recipient] ?? "") > Date.parse(now);
  if (row.kind !== "activity") return false;
  const split = row.document.expenses.find(e => e.id === expenseId);
  return !!split && split.expense.mode === "paid" && claimState(split) === "agreed" && !split.repayments.some(r => r.status === "disputed") && (balances(split)[recipient] ?? 0) > 0;
}
