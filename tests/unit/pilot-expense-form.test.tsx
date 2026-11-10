import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ExpenseForm } from "@/components/pilot-expense-form";
it("allows a single payer other than the organizer and focuses the review heading", () => {
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <ExpenseForm email="organizer@example.com" busy={false} onSave={save} />,
  );
  fireEvent.change(screen.getAllByLabelText("Name")[1], {
    target: { value: "Guest" },
  });
  fireEvent.change(screen.getAllByLabelText("Email")[1], {
    target: { value: "guest@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Title"), {
    target: { value: "Dinner" },
  });
  fireEvent.change(screen.getByLabelText("Total (KRW)"), {
    target: { value: "60000" },
  });
  fireEvent.keyDown(screen.getByLabelText("Who paid"), { key: "ArrowDown" });
  fireEvent.click(screen.getByRole("option", { name: "Guest" }));
  fireEvent.click(screen.getByRole("button", { name: "Review split" }));
  expect(
    screen.getByRole("heading", { name: "Review before publishing" }),
  ).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Publish split" }));
  expect(
    save.mock.calls[0][0].participants.map(
      (person: { paid: number }) => person.paid,
    ),
  ).toEqual([0, 60000]);
});
