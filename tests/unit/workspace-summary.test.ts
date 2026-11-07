import { describe, expect, it } from "vitest";
import { recoverySummary, splitStage } from "@/lib/pilot/workspace-summary";
import type { Split } from "@/lib/pilot/model";
const split: Split = {
  id: "dinner",
  organizer: "a@example.com",
  revision: 1,
  expense: {
    title: "Dinner",
    mode: "paid",
    participants: [
      { name: "A", email: "a@example.com", paid: 60000 },
      { name: "B", email: "b@example.com", paid: 0 },
      { name: "C", email: "c@example.com", paid: 0 },
    ],
    items: [
      {
        name: "Food",
        amount: 60000,
        included: ["a@example.com", "b@example.com", "c@example.com"],
      },
    ],
  },
  responses: {},
  repayments: [],
  audit: [],
};
describe("shared workspace state", () => {
  it("keeps claimed and disputed transfers out of recovery totals", () => {
    const current = {
      ...split,
      repayments: [
        {
          id: "p",
          from: "b@example.com",
          to: "a@example.com",
          amount: 20000,
          status: "reported" as const,
        },
      ],
    };
    expect(recoverySummary([current], "a@example.com")).toEqual({
      owe: 0,
      owed: 40000,
      paid: 60000,
      received: 0,
    });
    expect(splitStage(current, "a@example.com")).toBe("needs_action");
    current.repayments[0].status = "disputed" as "reported";
    expect(recoverySummary([current], "a@example.com").owed).toBe(40000);
  });
  it("exposes overpayments after a confirmed transfer and smaller revision", () => {
    const current: Split = {
      ...split,
      expense: {
        ...split.expense,
        participants: [
          { name: "A", email: "a@example.com", paid: 30000 },
          { name: "B", email: "b@example.com", paid: 0 },
        ],
        items: [
          {
            name: "Food",
            amount: 30000,
            included: ["a@example.com", "b@example.com"],
          },
        ],
      },
      repayments: [
        {
          id: "p",
          from: "b@example.com",
          to: "a@example.com",
          amount: 20000,
          status: "confirmed",
        },
      ],
    };
    expect(recoverySummary([current], "a@example.com").owe).toBe(5000);
    expect(splitStage(current, "a@example.com")).toBe("needs_action");
  });
});
