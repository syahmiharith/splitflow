import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SpendingPlanCard } from "@/components/activity/spending-plan-card";
import { setSpendingPlan, summarizeSpendingPlan } from "@/lib/activity/planning";

const previous = setSpendingPlan({ limit: 600000, categories: [{ name: "Hotel", amount: 300000 }, { name: "Food", amount: 180000 }] }, []);
const current = setSpendingPlan({ limit: 600000, categories: [{ name: "Hotel", amount: 330000 }, { name: "Food", amount: 150000 }] }, []);
const summary = summarizeSpendingPlan(current, []);

describe("spending plan cards", () => {
  it("shows old/new allowances and explicit classification changes before confirmation", () => {
    const { container } = render(<SpendingPlanCard review current={current} previous={previous} summary={summary} reason="Hotel costs more" classificationChanges={["Hotel expenses: Room deposit"]} />);
    expect(screen.getByText("₩300,000 → ₩330,000")).toBeVisible();
    expect(screen.getByText("₩180,000 → ₩150,000")).toBeVisible();
    expect(screen.getByText("Hotel expenses: Room deposit")).toBeVisible();
    expect(screen.getByText("Allowance, not available cash")).toBeVisible();
    expect(container.querySelector("input")).toBeNull();
  });
  it("shows compact reported-cost states after saving and discloses category detail", () => {
    render(<SpendingPlanCard current={current} summary={summary} />);
    expect(screen.getByText("Reported costs")).toBeVisible();
    expect(screen.getByText("Remaining allowance")).toBeVisible();
    expect(screen.getByText("Hotel")).not.toBeVisible();
  });
});
