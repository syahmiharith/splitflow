import { describe, it, expect } from "vitest";
import {
  calculateExpense,
  applyCommand,
  balances,
  type Expense,
  type Split,
} from "@/lib/pilot/model";
const expense: Expense = {
  title: "Shared activity",
  mode: "paid",
  participants: [
    { email: "a@example.test", name: "Alex", paid: 100 },
    { email: "b@example.test", name: "Bo", paid: 0 },
  ],
  items: [
    {
      name: "Tickets",
      amount: 100,
      included: ["a@example.test", "b@example.test"],
    },
  ],
};
const base = (): Split => ({
  id: crypto.randomUUID(),
  organizer: "a@example.test",
  revision: 1,
  expense: structuredClone(expense),
  responses: { "b@example.test": { revision: 1, status: "accepted", reason: "" } },
  repayments: [],
  audit: [],
});
describe("unified financial controls", () => {
  it("allocates integer won proportionally to units", () => {
    const input = {
      ...expense,
      items: [
        {
          ...expense.items[0],
          units: { "a@example.test": 1, "b@example.test": 2 },
        },
      ],
    };
    expect(calculateExpense(input).shares).toEqual({
      "a@example.test": 33,
      "b@example.test": 67,
    });
  });
  it("rejects conflicting and incomplete unit rules", () => {
    expect(() =>
      calculateExpense({
        ...expense,
        items: [{ ...expense.items[0], units: { "a@example.test": 1 } }],
      }),
    ).toThrow();
    expect(() =>
      calculateExpense({
        ...expense,
        items: [
          {
            ...expense.items[0],
            units: { "a@example.test": 1, "b@example.test": 2 },
            custom: { "a@example.test": 50, "b@example.test": 50 },
          },
        ],
      }),
    ).toThrow();
  });
  it("retains a reference and lets only the recipient resolve a dispute", () => {
    const reported = applyCommand(base(), "b@example.test", {
      type: "report",
      to: "a@example.test",
      amount: 50,
      reference: "Bank transfer 123",
    } as Parameters<typeof applyCommand>[2]);
    expect(reported.repayments[0]).toHaveProperty(
      "reference",
      "Bank transfer 123",
    );
    const paymentId = reported.repayments[0].id;
    const disputed = applyCommand(reported, "a@example.test", {
      type: "receipt",
      paymentId,
      status: "disputed",
    });
    expect(balances(disputed)["b@example.test"]).toBe(50);
    expect(() =>
      applyCommand(disputed, "b@example.test", {
        type: "receipt",
        paymentId,
        status: "confirmed",
      }),
    ).toThrow();
    const resolved = applyCommand(disputed, "a@example.test", {
      type: "receipt",
      paymentId,
      status: "confirmed",
    });
    expect(balances(resolved)["b@example.test"]).toBe(0);
    expect(resolved.repayments).toHaveLength(1);
    expect(disputed.repayments[0].status).toBe("disputed");
    expect(() =>
      applyCommand(resolved, "a@example.test", {
        type: "receipt",
        paymentId,
        status: "confirmed",
      }),
    ).toThrow();
  });
});
