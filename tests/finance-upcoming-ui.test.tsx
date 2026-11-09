import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinanceOverview } from "@/components/activity/finance-overview";
import { emptyFinance } from "@/lib/finance/model";
import { loadFinance } from "@/lib/finance/client";
vi.mock("@/lib/finance/client", () => ({ loadFinance: vi.fn() }));
describe("upcoming review handoff", () => {
  it("shows the computed date and hands the exact occurrence to conversation", async () => {
    const state = emptyFinance();
    state.accounts.push({ id: "bank", name: "Bank", kind: "bank", currency: "KRW", openingBalance: 0, archived: false });
    state.schedules.push({ id: "rent", name: "Rent", accountId: "bank", kind: "expense", amount: 1000, start: "2026-01-31", frequency: "monthly", paused: false, occurrences: { "2026-01-31": "recorded", "2026-02-28": "skipped" } });
    vi.mocked(loadFinance).mockResolvedValue({ revision: 1, state });
    const onAsk = vi.fn();
    render(<FinanceOverview guest email="alex@example.test" onAsk={onAsk} initialAccountId="bank" />);
    await screen.findByRole("heading", { name: "Your finances" });
    expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Upcoming" }));
    const occurrence = screen.getByRole("button", { name: /Rent.*2026-03-31/ });
    expect(occurrence).toHaveTextContent("Expected cost · not recorded");
    fireEvent.click(occurrence);
    expect(onAsk).toHaveBeenCalledWith("Review schedule rent (Rent), expected occurrence 2026-03-31, and help me record or skip it.");
  });
});
