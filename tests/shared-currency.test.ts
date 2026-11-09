import { describe, expect, it } from "vitest";
import { applyCommand, calculateExpense, type Split } from "@/lib/pilot/model";
import { moneySummary, moneySummaries } from "@/lib/activity/money-summary";
import { setSpendingPlan, summarizeSpendingPlan } from "@/lib/activity/planning";
const a = "a@example.test", b = "b@example.test";
function split(currency?: string): Split {
  return { id: crypto.randomUUID(), organizer: a, revision: 1, expense: { title: "Dinner", currency, mode: "paid", participants: [{ name: "Alex", email: a, paid: 1001 }, { name: "Bo", email: b, paid: 0 }], items: [{ name: "Dinner", amount: 1001, included: [a, b] }] }, responses: { [b]: { status: "accepted", revision: 1, reason: "" } }, repayments: [], audit: [] };
}
describe("shared currency boundaries", () => {
  it("allocates integer minor units and never sums currencies", () => {
    const usd = split("USD"), krw = split();
    expect(Object.values(calculateExpense(usd.expense).shares).reduce((a, b) => a + b, 0)).toBe(1001);
    expect(() => moneySummary([usd, krw], a)).toThrow(/currency/);
    expect(moneySummaries([usd, krw], a).map(s => [s.currency, s.spent])).toEqual([["USD", 1001], ["KRW", 1001]]);
  });
  it("cannot revise a currency under existing agreements or repayments", () => {
    const record = split("USD");
    expect(() => applyCommand(record, a, { type: "revise", expense: { ...record.expense, currency: "KRW" }, reason: "Change currency" })).toThrow(/currency/);
  });
  it("keeps KRW activity allowances independent from foreign costs", () => {
    const usd = split("USD");
    expect(summarizeSpendingPlan({ limit: 10000, categories: [] }, [usd]).reportedCost).toBe(0);
    expect(() => setSpendingPlan({ limit: 10000, categories: [{ name: "Food", amount: 10000, expenseIds: [usd.id] }] }, [usd])).toThrow(/KRW/);
  });
});
