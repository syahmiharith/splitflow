import {
  balances,
  claimState,
  calculateExpense,
  settlements,
  type Split,
} from "@/lib/pilot/model";

/** Read-only summary. Never cancel obligations from different expenses. */
export function moneySummary(splits: Split[], email: string) {
  const currencies = [...new Set(splits.map(s => s.expense.currency ?? "KRW"))];
  if (currencies.length > 1) throw Error("Select a currency before combining monetary amounts.");
  const currency = currencies[0] ?? "KRW";
  let spent = 0,
    share = 0,
    paid = 0,
    owe = 0,
    owed = 0,
    planned = 0,
    pendingClaims = 0,
    disputedClaims = 0;
  const obligations: {
    splitId: string;
    title: string;
    from: string;
    to: string;
    amount: number;
    currency: string;
  }[] = [];
  for (const split of splits) {
    const calculation = calculateExpense(split.expense);
    if (split.expense.mode === "planned") {
      planned += calculation.shares[email] ?? 0;
    }
    const state = claimState(split);
    if (state === "pending") pendingClaims += 1;
    if (state === "disputed") disputedClaims += 1;
    if (split.expense.mode === "paid") {
      spent += calculation.total;
      share += calculation.shares[email] ?? 0;
      paid += split.expense.participants.find((p) => p.email === email)?.paid ?? 0;
    }
    const remaining = balances(split)[email] ?? 0;
    owe += Math.max(0, remaining);
    owed += Math.max(0, -remaining);
    obligations.push(
      ...settlements(split).map((t) => ({
        ...t,
        splitId: split.id,
        currency,
        title: split.expense.title,
      })),
    );
  }
  return { currency, spent, share, paid, owe, owed, planned, pendingClaims, disputedClaims, obligations };
}

export function moneySummaries(splits: Split[], email: string) {
  const currencies = [...new Set(splits.map(s => s.expense.currency ?? "KRW"))];
  return (currencies.length ? currencies : ["KRW"]).map(currency => moneySummary(splits.filter(s => (s.expense.currency ?? "KRW") === currency), email));
}
