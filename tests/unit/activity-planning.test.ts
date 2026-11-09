import { describe, expect, it } from "vitest";
import { setSpendingPlan, spendingPlanChanges, summarizeSpendingPlan } from "@/lib/activity/planning";
import type { Split } from "@/lib/pilot/model";

const email = "alex@example.test", other = "minji@example.test";
function expense(amount: number, mode: "paid" | "planned" = "paid"): Split {
  return {
    id: crypto.randomUUID(), organizer: email, revision: 1,
    expense: {
      title: "Hotel", mode,
      participants: [{ name: "Alex", email, paid: amount }, { name: "Minji", email: other, paid: 0 }],
      items: [{ name: "Room", amount, included: [email, other] }],
    },
    responses: {}, repayments: [], audit: [],
  };
}
const initial = {
  limit: 600000,
  categories: [{ name: "Hotel", amount: 300000 }, { name: "Food", amount: 180000 }, { name: "Transport", amount: 120000 }],
};

describe("activity spending plans", () => {
  it("keeps spending allowances separate from proposed costs and external repayments", () => {
    const room = expense(300000), proposal = expense(60000, "planned");
    room.repayments = [{ id: crypto.randomUUID(), from: other, to: email, amount: 150000, status: "confirmed" }];
    const before = structuredClone([room, proposal]);
    const plan = setSpendingPlan({ ...initial, categories: [{ name: "Hotel", amount: 300000, expenseIds: [room.id] }] }, before);
    expect(summarizeSpendingPlan(plan, before)).toMatchObject({
      limit: 600000, unallocatedAllowance: 300000, reportedCost: 300000,
      remainingAllowance: 300000, plannedCost: 60000, uncategorizedReportedCost: 0,
      categories: [{ name: "Hotel", allowance: 300000, reportedCost: 300000, remainingAllowance: 0 }],
    });
    expect(before).toEqual([room, proposal]);
    expect(room.responses).toEqual({});
  });
  it("reviews a transfer of allowance without changing the total or any expense", () => {
    const before = setSpendingPlan(initial, []);
    const after = setSpendingPlan({ ...initial, categories: [{ name: "Hotel", amount: 330000 }, { name: "Food", amount: 150000 }, { name: "Transport", amount: 120000 }] }, []);
    expect(spendingPlanChanges(before, after)).toMatchObject({
      limit: { before: 600000, after: 600000 },
      categories: [{ name: "Hotel", before: 300000, after: 330000 }, { name: "Food", before: 180000, after: 150000 }, { name: "Transport", before: 120000, after: 120000 }],
    });
    expect(before.categories[0].amount).toBe(300000);
  });
  it("shows overspending and uncategorized reported costs without inventing classifications", () => {
    const hotel = expense(630000);
    const plan = setSpendingPlan(initial, [hotel]);
    expect(summarizeSpendingPlan(plan, [hotel])).toMatchObject({
      reportedCost: 630000, remainingAllowance: -30000, uncategorizedReportedCost: 630000,
    });
    expect(summarizeSpendingPlan(plan, [hotel]).categories[0].reportedCost).toBe(0);
  });
  it("rejects excess allowances, duplicate names and non-integer money", () => {
    expect(() => setSpendingPlan({ limit: 10, categories: [{ name: "Food", amount: 11 }] }, [])).toThrow("exceed");
    expect(() => setSpendingPlan({ limit: 10, categories: [{ name: "Food", amount: 1 }, { name: " food ", amount: 1 }] }, [])).toThrow("different name");
    expect(() => setSpendingPlan({ limit: 1.5, categories: [] }, [])).toThrow();
  });
  it("rejects unauthorized references and double counting across categories", () => {
    const room = expense(300000);
    expect(() => setSpendingPlan({ limit: 600000, categories: [{ name: "Hotel", amount: 300000, expenseIds: [room.id] }] }, [])).toThrow("this activity");
    expect(() => setSpendingPlan({ limit: 600000, categories: [{ name: "Hotel", amount: 300000, expenseIds: [room.id] }, { name: "Food", amount: 10000, expenseIds: [room.id] }] }, [room])).toThrow("only one");
  });
  it("exposes removed categories and classification changes in the review", () => {
    const room = expense(300000);
    const before = setSpendingPlan({ ...initial, categories: [{ name: "Hotel", amount: 300000, expenseIds: [room.id] }] }, [room]);
    const after = setSpendingPlan({ ...initial, categories: [] }, [room]);
    expect(spendingPlanChanges(before, after).categories).toEqual([{ name: "Hotel", before: 300000, after: 0, removed: true, previousExpenseIds: [room.id], expenseIds: [] }]);
  });
});
