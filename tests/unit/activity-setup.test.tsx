import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import {
  NewActivityForm,
  ScheduleForm,
} from "@/components/activity/activity-setup";
import {
  createActivity,
  createGroup,
  changeActivity,
} from "@/lib/activity/model";
const people = [
  { name: "Alex", email: "alex@example.test" },
  { name: "Minji", email: "minji@example.test" },
];
it("keeps invited group members unavailable until they join", () => {
  const group = createGroup(people[0].email, { name: "Home", people });
  render(
    <NewActivityForm
      email={people[0].email}
      group={group}
      groups={[group]}
      busy={false}
      onSave={vi.fn()}
    />,
  );
  expect(screen.getByRole("checkbox", { name: /Minji/ })).toBeDisabled();
  expect(screen.getByRole("checkbox", { name: /Minji/ })).not.toBeChecked();
  expect(screen.getByText(/Invitation pending/)).toBeVisible();
});
it("reuses an existing cost for recurring review without recording a payment", () => {
  const activity = changeActivity(
    createActivity(people[0].email, {
      title: "Rent",
      kind: "recurring",
      people,
    }),
    people[0].email,
    {
      type: "expense",
      id: crypto.randomUUID(),
      expense: {
        title: "Monthly rent",
        mode: "paid",
        participants: people.map((p, i) => ({
          ...p,
          paid: i === 0 ? 100000 : 0,
        })),
        items: [
          {
            name: "Rent",
            amount: 100000,
            included: people.map((p) => p.email),
          },
        ],
      },
    },
  );
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <ScheduleForm
      activity={activity}
      email={people[0].email}
      busy={false}
      onSave={save}
    />,
  );
  expect(screen.getByLabelText("Total (KRW)", { exact: true })).toHaveValue(
    100000,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Review recurring terms" }),
  );
  expect(
    screen.getByRole("heading", { name: "Review monthly terms" }),
  ).toBeVisible();
  expect(save).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Share recurring terms" }),
  );
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "schedule",
      expectedVersion: 0,
      expense: expect.objectContaining({
        mode: "paid",
        title: "Monthly rent",
      }),
    }),
  );
});
