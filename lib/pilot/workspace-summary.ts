import { splitState } from "./next-action";
import { balances, type Split } from "./model";
export function splitStage(split: Split, email: string) {
  return splitState(split, email).stage;
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
