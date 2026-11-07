import { balances, type Split } from "./model";
export function splitStage(
  split: Split,
  email: string,
): "needs_action" | "waiting" | "settled" {
  if (split.repayments.some((p) => p.to === email && p.status === "reported"))
    return "needs_action";
  if (
    split.organizer === email &&
    Object.values(split.responses).some(
      (r) => r.status === "correction" || r.status === "declined",
    )
  )
    return "needs_action";
  if (split.expense.mode === "planned")
    return !split.responses[email] ? "needs_action" : "waiting";
  if ((balances(split)[email] ?? 0) > 0) return "needs_action";
  return Object.values(balances(split)).every((n) => n === 0) &&
    !split.repayments.some((p) => p.status !== "confirmed")
    ? "settled"
    : "waiting";
}
export function recoverySummary(splits: Split[], email: string) {
  return splits
    .filter((s) => s.expense.mode === "paid")
    .reduce(
      (sum, split) => {
        const balance = balances(split)[email] ?? 0;
        sum.owe += Math.max(0, balance);
        sum.owed += Math.max(0, -balance);
        sum.paid +=
          split.expense.participants.find((p) => p.email === email)?.paid ?? 0;
        sum.received += split.repayments
          .filter((p) => p.to === email && p.status === "confirmed")
          .reduce((n, p) => n + p.amount, 0);
        return sum;
      },
      { owe: 0, owed: 0, paid: 0, received: 0 },
    );
}
