import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { ExpenseCard } from "@/components/activity/expense-card";
import type { Split } from "@/lib/pilot/model";
it("requires renewed review after a background revision before accepting", () => {
  const split: Split = {
    id: crypto.randomUUID(),
    revision: 1,
    organizer: "a@example.test",
    expense: {
      title: "Plan",
      mode: "planned",
      participants: [
        { name: "A", email: "a@example.test", paid: 100 },
        { name: "B", email: "b@example.test", paid: 0 },
      ],
      items: [
        {
          name: "Cost",
          amount: 100,
          included: ["a@example.test", "b@example.test"],
        },
      ],
    },
    responses: {},
    repayments: [],
    audit: [],
  };
  const command = vi.fn();
  const { rerender } = render(
    <ExpenseCard
      split={split}
      email="b@example.test"
      busy={false}
      onCommand={command}
      onEdit={() => {}}
    />,
  );
  rerender(
    <ExpenseCard
      split={{ ...split, revision: 2 }}
      email="b@example.test"
      busy={false}
      onCommand={command}
      onEdit={() => {}}
    />,
  );
  expect(screen.getByRole("button", { name: "Accept share" })).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "I reviewed the updated expense" }),
  );
  expect(screen.getByRole("button", { name: "Accept share" })).toBeEnabled();
});

import { RecurringTerms } from "@/components/activity/recurring-terms";
import { createActivity, changeActivity } from "@/lib/activity/model";
it("shows each recurring share and payer and requires review of changed terms", () => {
  const activity = changeActivity(
    createActivity("a@example.test", {
      title: "Rent",
      kind: "recurring",
      people: [
        { name: "A", email: "a@example.test" },
        { name: "B", email: "b@example.test" },
      ],
    }),
    "a@example.test",
    {
      type: "schedule",
      expectedVersion: 0,
      start: "2026-11-08",
      dueDay: 5,
      variable: false,
      expense: {
        title: "Rent",
        mode: "paid",
        participants: [
          { name: "A", email: "a@example.test", paid: 100 },
          { name: "B", email: "b@example.test", paid: 0 },
        ],
        items: [
          {
            name: "Rent",
            amount: 100,
            included: ["a@example.test", "b@example.test"],
          },
        ],
      },
    },
  );
  const command = vi.fn();
  const { rerender } = render(
    <RecurringTerms
      activity={activity}
      email="b@example.test"
      busy={false}
      onCommand={command}
    />,
  );
  expect(screen.getByText("Your recurring share")).toBeVisible();
  expect(screen.getByText("₩50")).toBeVisible();
  expect(screen.getByText("A: share ₩50 · expects to pay ₩100")).toBeVisible();
  rerender(
    <RecurringTerms
      activity={{
        ...activity,
        schedule: { ...activity.schedule!, version: 2 },
      }}
      email="b@example.test"
      busy={false}
      onCommand={command}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Accept recurring terms" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "I reviewed these recurring terms" }),
  );
  expect(
    screen.getByRole("button", { name: "Accept recurring terms" }),
  ).toBeEnabled();
});
