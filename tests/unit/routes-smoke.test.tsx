import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoreProvider } from "@/lib/store";
import DashboardPage from "@/app/dashboard/page";
import ProposalsPage from "@/app/proposals/page";
import AnalyticsPage from "@/app/analytics/page";
import InboxPage from "@/app/inbox/page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

function renderWithStore(ui: React.ReactNode) {
  return render(<StoreProvider>{ui}</StoreProvider>);
}

describe("route smoke tests", () => {
  it("renders dashboard route", () => {
    renderWithStore(<DashboardPage />);
    expect(screen.getByTestId("dashboard-route")).toBeInTheDocument();
  });

  it("renders proposals route", () => {
    renderWithStore(<ProposalsPage />);
    expect(screen.getByTestId("proposals-route")).toBeInTheDocument();
  });

  it("renders inbox route", () => {
    renderWithStore(<InboxPage />);
    expect(screen.getByTestId("inbox-route")).toBeInTheDocument();
  });

  it("renders analytics route", () => {
    renderWithStore(<AnalyticsPage />);
    expect(screen.getByTestId("analytics-route")).toBeInTheDocument();
  });
});
