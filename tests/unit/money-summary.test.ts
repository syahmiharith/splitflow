import { describe, expect, it } from "vitest";
import { applyCommand } from "@/lib/pilot/model";
import { moneySummary } from "@/lib/activity/money-summary";
import { createActivity, changeActivity } from "@/lib/activity/model";
const a = "a@example.test",
  b = "b@example.test";
function split(payer = a, mode: "paid" | "planned" = "paid") {
  const activity = createActivity(a, {
    title: "Dinner",
    kind: "quick",
    people: [
      { name: "Alex", email: a },
      { name: "Bo", email: b },
    ],
  });
  const result = changeActivity(activity, a, {
    type: "expense",
    id: crypto.randomUUID(),
    expense: {
      title: "Dinner",
      mode,
      participants: [
        { name: "Alex", email: a, paid: payer === a ? 60000 : 0 },
        { name: "Bo", email: b, paid: payer === b ? 60000 : 0 },
      ],
      items: [{ name: "Dinner", amount: 60000, included: [a, b] }],
    },
  }).expenses[0];
  return applyCommand(result, b, { type: "respond", status: "accepted", reason: "" });
}
describe("money overview", () => {
  it("keeps opposite obligations separate rather than calling them settled", () => {
    const result = moneySummary([split(a), split(b)], a);
    expect(result).toMatchObject({
      owe: 30000,
      owed: 30000,
      spent: 120000,
      share: 60000,
      paid: 60000,
    });
    expect(result.obligations).toHaveLength(2);
  });
  it("excludes planned shares from repayable amounts", () => {
    expect(moneySummary([split(a, "planned")], b)).toMatchObject({
      owe: 0,
      owed: 0,
      spent: 0,
      planned: 30000,
      obligations: [],
    });
  });
  it("retains confirmed transfer credits on legacy planned records", () => {
    const record = split(a, "planned");
    record.repayments = [{id:crypto.randomUUID(),from:b,to:a,amount:500,status:"confirmed"}];
    expect(moneySummary([record], b)).toMatchObject({owe:0,owed:500,spent:0,planned:30000});
  });
  it("only confirmed transfers change totals and preserves overpayment credits", () => {
    const record = split();
    record.repayments = [
      {
        id: crypto.randomUUID(),
        from: b,
        to: a,
        amount: 40000,
        status: "reported",
        reference: "Bank transfer",
      },
    ];
    expect(moneySummary([record], b).owe).toBe(30000);
    record.repayments[0].status = "disputed";
    expect(moneySummary([record], b).owe).toBe(30000);
    record.repayments[0].status = "confirmed";
    expect(moneySummary([record], b)).toMatchObject({ owe: 0, owed: 10000 });
  });
});
