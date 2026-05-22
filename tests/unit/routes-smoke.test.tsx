import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StoreProvider } from "@/lib/store";
import HomePage from "@/app/page";
import GroupOverviewPage from "@/app/groups/[groupId]/page";
import GroupChatPage from "@/app/groups/[groupId]/chat/page";
import GroupProposalsPage from "@/app/groups/[groupId]/proposals/page";
import GroupInboxPage from "@/app/groups/[groupId]/inbox/page";
import GroupSettingsPage from "@/app/groups/[groupId]/settings/page";
import AnalyticsPage from "@/app/analytics/page";
import AgentLabPage from "@/app/agent-lab/page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  )
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ groupId: "bbq-crew" }),
  usePathname: () => "/groups/bbq-crew/chat",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  redirect: vi.fn()
}));

vi.mock("@ai-sdk/react", () => ({
  useChat: () => ({
    sendMessage: vi.fn(),
    status: "ready",
    error: undefined
  })
}));

function renderWithStore(ui: React.ReactNode) {
  return render(<StoreProvider>{ui}</StoreProvider>);
}

describe("route smoke tests", () => {
  it("renders global home route", () => {
    renderWithStore(<HomePage />);
    expect(screen.getByTestId("home-route")).toBeInTheDocument();
  });

  it("renders group overview route", () => {
    renderWithStore(<GroupOverviewPage />);
    expect(screen.getByTestId("group-overview-route")).toBeInTheDocument();
  });

  it("renders group chat route", () => {
    renderWithStore(<GroupChatPage />);
    expect(screen.getByTestId("chat-route")).toBeInTheDocument();
  });

  it("renders group proposals route", () => {
    renderWithStore(<GroupProposalsPage />);
    expect(screen.getByTestId("group-proposals-route")).toBeInTheDocument();
  });

  it("renders group inbox route", () => {
    renderWithStore(<GroupInboxPage />);
    expect(screen.getByTestId("inbox-route")).toBeInTheDocument();
  });

  it("renders group settings route", () => {
    renderWithStore(<GroupSettingsPage />);
    expect(screen.getByTestId("group-settings-route")).toBeInTheDocument();
  });

  it("renders analytics route", () => {
    renderWithStore(<AnalyticsPage />);
    expect(screen.getByTestId("analytics-route")).toBeInTheDocument();
  });

  it("renders agent lab route", () => {
    renderWithStore(<AgentLabPage />);
    expect(screen.getByTestId("agent-lab-route")).toBeInTheDocument();
  });
});
