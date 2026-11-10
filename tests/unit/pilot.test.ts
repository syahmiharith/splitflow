import { describe, expect, it } from "vitest";
import {
  applyCommand,
  balances,
  settlements,
  calculateExpense,
  expenseSchema,
  type Expense,
  type Split,
} from "@/lib/pilot/model";
const expense: Expense = {
  title: "Dinner",
  mode: "paid",
  participants: [
    { name: "A", email: "a@example.com", paid: 60001 },
    { name: "B", email: "b@example.com", paid: 0 },
    { name: "C", email: "c@example.com", paid: 0 },
  ],
  items: [
    {
      name: "Dinner",
      amount: 60001,
      included: ["a@example.com", "b@example.com", "c@example.com"],
    },
  ],
};
it("bounds item membership input to the supported participant limit",()=>{
  const included=Array.from({length:31},(_,i)=>`person${i}@example.test`);
  expect(expenseSchema.safeParse({...expense,items:[{...expense.items[0],included}]}).success).toBe(false);
  expect(expenseSchema.safeParse(expense).success).toBe(true);
});
const split: Split = {
  id: crypto.randomUUID(),
  organizer: "a@example.com",
  revision: 1,
  expense,
  responses: {
    "b@example.com": { revision: 1, status: "accepted", reason: "" },
    "c@example.com": { revision: 1, status: "accepted", reason: "" },
  },
  repayments: [],
  audit: [],
};
describe("pilot financial workflow", () => {
  it("conserves won on equal splits", () => {
    expect(Object.values(calculateExpense(expense).shares)).toEqual([
      20001, 20000, 20000,
    ]);
  });
  it("reconciles exclusions and multiple payers", () => {
    const e = structuredClone(expense);
    e.participants[0].paid = 40001;
    e.participants[1].paid = 20000;
    e.items[0].included = ["a@example.com", "b@example.com"];
    expect(calculateExpense(e).shares["c@example.com"]).toBe(0);
  });
  it("requires custom shares to reconcile", () => {
    const e = structuredClone(expense);
    e.items[0].custom = { "a@example.com": 1 };
    expect(() => calculateExpense(e)).toThrow();
  });
  it("only confirmed receipts change balances", () => {
    const reported = applyCommand(split, "b@example.com", {
      type: "report",
      to: "a@example.com",
      amount: 20000,
    });
    expect(balances(reported)["b@example.com"]).toBe(20000);
    expect(() =>
      applyCommand(reported, "b@example.com", {
        type: "receipt",
        paymentId: reported.repayments[0].id,
        status: "confirmed",
      }),
    ).toThrow();
    const confirmed = applyCommand(reported, "a@example.com", {
      type: "receipt",
      paymentId: reported.repayments[0].id,
      status: "confirmed",
    });
    expect(balances(confirmed)["b@example.com"]).toBe(0);
  });
  it("retains repayment history and exposes overpayments after revision", () => {
    const s = structuredClone(split);
    s.repayments = [
      {
        id: crypto.randomUUID(),
        from: "b@example.com",
        to: "a@example.com",
        amount: 20000,
        status: "confirmed",
      },
    ];
    const e = structuredClone(expense);
    e.items[0].amount = 30000;
    e.participants[0].paid = 30000;
    const changed = applyCommand(s, "a@example.com", {
      type: "revise",
      expense: e,
      reason: "Correct total",
    });
    expect(changed.repayments).toEqual(s.repayments);
    expect(balances(changed)["b@example.com"]).toBe(0);
    const bAccepted = applyCommand(changed, "b@example.com", { type: "respond", status: "accepted", reason: "" });
    const agreed = applyCommand(bAccepted, "c@example.com", { type: "respond", status: "accepted", reason: "" });
    expect(balances(agreed)["b@example.com"]).toBe(-10000);
  });
  it("preserves only unaffected responses", () => {
    const s = structuredClone(split);
    s.responses["c@example.com"] = {
      revision: 1,
      status: "accepted",
      reason: "",
    };
    s.responses["b@example.com"] = {
      revision: 1,
      status: "accepted",
      reason: "",
    };
    const e = structuredClone(expense);
    e.items[0].custom = {
      "a@example.com": 20002,
      "b@example.com": 19999,
      "c@example.com": 20000,
    };
    const changed = applyCommand(s, "a@example.com", {
      type: "revise",
      expense: e,
      reason: "Adjust shares",
    });
    expect(changed.responses["c@example.com"]).toBeDefined();
    expect(changed.responses["b@example.com"]).toBeUndefined();
  });
  it("retains explicit disagreement with an incurred claim", () => {
    expect(
      applyCommand(split, "b@example.com", {
        type: "respond",
        status: "declined",
        reason: "Wrong share",
      }).responses["b@example.com"].status,
    ).toBe("declined");
  });
  it("provides exact remaining recipients for multiple payers and confirmed transfers", () => {
    const s = structuredClone(split);
    s.expense.participants[0].paid = 40001;
    s.expense.participants[1].paid = 20000;
    expect(settlements(s)).toEqual([
      { from: "c@example.com", to: "a@example.com", amount: 20000 },
    ]);
    s.repayments = [
      {
        id: crypto.randomUUID(),
        from: "c@example.com",
        to: "a@example.com",
        amount: 10000,
        status: "confirmed",
      },
    ];
    expect(settlements(s)).toEqual([
      { from: "c@example.com", to: "a@example.com", amount: 10000 },
    ]);
  });
});
