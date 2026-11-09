import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionResult } from "@/components/activity/action-result";
import type { Preview } from "@/lib/assistant/model";

const expense: Preview = {
  title: "Dinner",
  lines: ["Add expense", "Alex: ₩20,000", "Minji: ₩40,000"],
  expense: {
    title: "Dinner", mode: "paid",
    participants: [
      { name: "Alex", email: "alex@example.test", paid: 60000 },
      { name: "Minji", email: "minji@example.test", paid: 0 },
    ],
    items: [
      { name: "Food", amount: 40000, included: ["alex@example.test", "minji@example.test"] },
      { name: "Drinks", amount: 20000, included: ["minji@example.test"] },
    ],
  },
};

describe("conversational transaction cards", () => {
  it("keeps unequal shares and exclusions visible in review, without inputs", () => {
    const { container } = render(<ActionResult preview={expense} review />);
    expect(screen.getByText("₩20,000")).toBeVisible();
    expect(screen.getByText("₩40,000")).toBeVisible();
    expect(screen.getByText("Drinks · ₩20,000 · Minji")).toBeVisible();
    expect(container.querySelector("input")).toBeNull();
  });
  it("collapses saved breakdowns while preserving the original snapshot", () => {
    const { container } = render(<ActionResult preview={expense} />);
    expect(container.querySelector("dl")).toBeNull();
    expect(container.querySelector("details")).not.toHaveAttribute("open");
    expect(screen.getByText("Alex: ₩20,000")).not.toBeVisible();
  });
  it.each(["Awaiting recipient confirmation", "Receipt confirmed", "Disputed"])(
    "keeps the server's %s receipt state visible after saving", (status) => {
      render(<ActionResult preview={{ title: "Dinner", lines: ["Review receipt"], summary: { amount: 20000, text: status } }} />);
      expect(screen.getByText(status)).toBeVisible();
      expect(screen.getByText("₩20,000")).toBeVisible();
    },
  );
  it("never hides revised amounts or access consequences before confirmation", () => {
    render(<ActionResult review preview={{ title: "Housemates", lines: ["Remove access: Minji", "Alex: ₩20,000 → ₩30,000"] }} />);
    expect(screen.getByText("Remove access: Minji")).toBeVisible();
    expect(screen.getByText("Alex: ₩20,000 → ₩30,000")).toBeVisible();
  });
});

it("separates a pending receipt decision from a saved confirmation in compact transfer cards", () => {
  const preview: Preview = { title: "Dinner", lines: ["Receipt history remains available"], transfer: { from: "Minji", to: "Alex", amount: 20000, status: "confirmed", claimStatus: "disputed", reference: "Bank transfer" } };
  const { rerender } = render(<ActionResult preview={preview} review />);
  expect(screen.getByText("Confirm receipt")).toBeVisible();
  expect(screen.queryByText("Receipt confirmed")).toBeNull();
  expect(screen.getByText("Claim disputed · prior agreements retained")).toBeVisible();
  expect(screen.getByText("Receipt history remains available")).not.toBeVisible();
  rerender(<ActionResult preview={preview} review saved />);
  expect(screen.getByText("Receipt confirmed")).toBeVisible();
  expect(screen.queryByText("Confirming receipt reduces the agreed outstanding amount.")).toBeNull();
});
