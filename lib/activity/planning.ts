import { z } from "zod";
import { calculateExpense, type Split } from "@/lib/pilot/model";

const won = z.number().int().min(0).max(1_000_000_000);
export const spendingPlanInput = z.object({
  limit: won.positive(),
  categories: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    amount: won,
    // Explicit classification only. Never infer a category from an expense title.
    expenseIds: z.array(z.uuid()).max(100).default([]),
  })).max(30).default([]),
});
export type SpendingPlan = z.infer<typeof spendingPlanInput>;

/** A plan is an allowance, not a bank balance, payment, or accepted obligation. */
export function setSpendingPlan(input: unknown, expenses: readonly Split[]): SpendingPlan {
  const plan = spendingPlanInput.parse(input);
  const names = plan.categories.map(category => category.name.toLocaleLowerCase("en-US"));
  if (new Set(names).size !== names.length)
    throw Error("Use a different name for each spending category.");
  const assigned = plan.categories.reduce((total, category) => total + category.amount, 0);
  if (assigned > plan.limit)
    throw Error("Category allowances exceed the spending limit. Reduce an allowance or review a higher limit.");
  const ids = plan.categories.flatMap(category => category.expenseIds);
  if (new Set(ids).size !== ids.length)
    throw Error("Assign each expense to only one spending category.");
  if (ids.some(id => !expenses.some(expense => expense.id === id)))
    throw Error("Choose expenses from this activity when assigning a category.");
  if (ids.some(id => expenses.some(split => split.id === id && (split.expense.currency ?? "KRW") !== "KRW")))
    throw Error("This activity allowance is in KRW. Classify only KRW expenses.");
  return plan;
}

export function summarizeSpendingPlan(plan: SpendingPlan, expenses: readonly Split[]) {
  const valid = setSpendingPlan(plan, expenses);
  const paid = expenses.filter(split => split.expense.mode === "paid" && (split.expense.currency ?? "KRW") === "KRW");
  const reported = (splits: readonly Split[]) => splits.reduce(
    (sum, split) => sum + calculateExpense(split.expense).total, 0,
  );
  const reportedCost = reported(paid);
  const categorized = new Set(valid.categories.flatMap(category => category.expenseIds));
  return {
    limit: valid.limit,
    allocatedAllowance: valid.categories.reduce((sum, category) => sum + category.amount, 0),
    unallocatedAllowance: valid.limit - valid.categories.reduce((sum, category) => sum + category.amount, 0),
    reportedCost,
    remainingAllowance: valid.limit - reportedCost,
    // Proposed spending is kept separate: it is not an incurred cost or available cash.
    plannedCost: reported(expenses.filter(split => split.expense.mode === "planned" && (split.expense.currency ?? "KRW") === "KRW")),
    uncategorizedReportedCost: reported(paid.filter(split => !categorized.has(split.id))),
    categories: valid.categories.map(category => {
      const reportedCost = reported(paid.filter(split => category.expenseIds.includes(split.id)));
      return {
        name: category.name,
        allowance: category.amount,
        reportedCost,
        remainingAllowance: category.amount - reportedCost,
      };
    }),
  };
}

/** Explicit old/new values for the stored proposal's shared-change review. */
export function spendingPlanChanges(previous: SpendingPlan | undefined, next: SpendingPlan) {
  const old = new Map((previous?.categories ?? []).map(category => [category.name, category]));
  const current = new Map(next.categories.map(category => [category.name, category]));
  return {
    limit: { before: previous?.limit ?? 0, after: next.limit },
    categories: [...new Set([...old.keys(), ...current.keys()])].map(name => ({
      name,
      before: old.get(name)?.amount ?? 0,
      after: current.get(name)?.amount ?? 0,
      removed: !current.has(name),
      expenseIds: current.get(name)?.expenseIds ?? [],
      previousExpenseIds: old.get(name)?.expenseIds ?? [],
    })),
  };
}

export type SpendingPlanSummary = ReturnType<typeof summarizeSpendingPlan>;
