import {
  balances,
  calculateExpense,
  settlements,
  type Split,
} from "@/lib/pilot/model";

/** Read-only summary. Never cancel obligations from different expenses. */
export function moneySummary(splits: Split[], email: string) {
  let spent = 0,
    share = 0,
    paid = 0,
    owe = 0,
    owed = 0,
    planned = 0;
  const obligations: {
    splitId: string;
    title: string;
    from: string;
    to: string;
    amount: number;
  }[] = [];
  for (const split of splits) {
    const calculation = calculateExpense(split.expense);
    if (split.expense.mode === "planned") {
      planned += calculation.shares[email] ?? 0;
      continue;
    }
    spent += calculation.total;
    share += calculation.shares[email] ?? 0;
    paid +=
      split.expense.participants.find((p) => p.email === email)?.paid ?? 0;
    const remaining = balances(split)[email] ?? 0;
    owe += Math.max(0, remaining);
    owed += Math.max(0, -remaining);
    obligations.push(
      ...settlements(split).map((t) => ({
        ...t,
        splitId: split.id,
        title: split.expense.title,
      })),
    );
  }
  return { spent, share, paid, owe, owed, planned, obligations };
}
