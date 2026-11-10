import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SpendingPlanEditor } from "@/components/activity/spending-plan-editor";
import { MoneyPage } from "@/components/activity/money-page";
import { createActivity, changeActivity } from "@/lib/activity/model";

const email = "alex@example.test";
const make = () => createActivity(email, { title: "Jeju", kind: "planned", people: [{ name: "Alex", email }, { name: "Minji", email: "minji@example.test" }] });
const plan = { limit: 600000, categories: [{ name: "Hotel", amount: 300000, expenseIds: [] }] };

describe("optional spending plan controls", () => {
  it("retains manual values, reviews first and submits the same typed plan only after confirmation", async () => {
    const user = userEvent.setup(), onReview = vi.fn().mockResolvedValue(undefined);
    render(<SpendingPlanEditor activity={make()} initialPlan={plan} busy={false} onReview={onReview} />);
    expect(screen.getByLabelText("Spending limit (KRW)")).toHaveValue(600000);
    fireEvent.change(screen.getByLabelText("Category 1 allowance (KRW)"), { target: { value: "330000" } });
    await user.click(screen.getByRole("button", { name: "Review plan" }));
    expect(onReview).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Review spending plan" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Edit plan" }));
    expect(screen.getByLabelText("Category 1 allowance (KRW)")).toHaveValue(330000);
    await user.click(screen.getByRole("button", { name: "Review plan" }));
    await user.click(screen.getByRole("button", { name: "Confirm plan" }));
    expect(onReview).toHaveBeenCalledWith({ type: "plan", plan: { ...plan, categories: [{ name: "Hotel", amount: 330000, expenseIds: [] }] }, reason: "Set initial spending plan" });
  });
  it("rejects excess allowances before any confirmation can appear", async () => {
    const onReview = vi.fn();
    render(<SpendingPlanEditor activity={make()} initialPlan={plan} busy={false} onReview={onReview} />);
    fireEvent.change(screen.getByLabelText("Spending limit (KRW)"), { target: { value: "1" } });
    await userEvent.click(screen.getByRole("button", { name: "Review plan" }));
    expect(screen.getByRole("alert")).toHaveTextContent("exceed");
    expect(screen.queryByRole("button", { name: "Confirm plan" })).toBeNull();
    expect(onReview).not.toHaveBeenCalled();
  });
  it("keeps planning overview read-only and returns actions to the activity conversation", async () => {
    const activity = changeActivity(make(), email, { type: "plan", plan, reason: "Plan trip" });
    const onOpen = vi.fn();
    const { container } = render(<MoneyPage title="Your splits" activities={[activity]} email={email} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Planning" }));
    expect(screen.getByText("₩600,000 limit")).toBeVisible();
    expect(screen.getByText("₩600,000 allowance left")).toBeVisible();
    expect(container.querySelector("input")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Jeju/ }));
    expect(onOpen).toHaveBeenCalledWith(activity.id);
  });
  it("shows monthly terms separately from expense totals and preserves the conversation handoff", async () => {
    const base = make();
    const recurring = changeActivity({ ...base, kind: "recurring" }, email, {
      type: "schedule", expectedVersion: 0,
      expense: {
        title: "Rent", mode: "paid",
        participants: base.people.map((person, index) => ({ ...person, paid: index === 0 ? 900000 : 0 })),
        items: [{ name: "Rent", amount: 900000, included: base.people.map(person => person.email) }],
      },
      start: "2026-11-01", dueDay: 1, variable: false,
    });
    const onOpen = vi.fn();
    render(<MoneyPage title="Your splits" activities={[recurring]} email={email} onOpen={onOpen} />);
    await userEvent.click(screen.getByRole("button", { name: "Planning" }));
    expect(screen.getByText("Monthly costs")).toBeVisible();
    expect(screen.getByText("1/2 accepted terms")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: /Rent.*due day 1/ }));
    expect(onOpen).toHaveBeenCalledWith(recurring.id);
  });

});
