import { expect, test, type Page } from "@playwright/test";

const bbqPrompt =
  "BBQ dinner for 8. I paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef.";

function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1024) < 768;
}

async function clearDemoStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

async function openMobileSidebarIfNeeded(page: Page) {
  if (!isMobile(page)) return;
  await page.getByTestId("mobile-sidebar-open").click();
  await expect(page.getByTestId("mobile-sidebar-overlay")).toBeVisible();
}

async function openMobileSidebarWithEdgeSwipe(page: Page) {
  await page.evaluate(() => {
    const start = new Event("touchstart", { bubbles: true });
    Object.defineProperty(start, "touches", { value: [{ clientX: 2, clientY: 320 }] });
    window.dispatchEvent(start);

    const end = new Event("touchend", { bubbles: true });
    Object.defineProperty(end, "changedTouches", { value: [{ clientX: 96, clientY: 324 }] });
    window.dispatchEvent(end);
  });
  await expect(page.getByTestId("mobile-sidebar-overlay")).toBeVisible();
}

async function resetDemoData(page: Page) {
  await page.getByTestId("header-actions-more").click();
  await page.getByTestId("reset-demo-data").click();
}

async function clickNewChat(page: Page) {
  if (!isMobile(page)) {
    await page.getByTestId("new-chat").click();
    return;
  }

  await openMobileSidebarIfNeeded(page);
  await page.getByTestId("mobile-sidebar-overlay").getByTestId("new-chat").click();
  await expect(page.getByTestId("chat-route")).toBeVisible();
}

async function createGroup(page: Page, name: string, description = "") {
  if (isMobile(page)) {
    await page.goto("/groups");
    await page.getByTestId("groups-create-group").click();
  } else {
    await page.getByTestId("group-switcher").click();
    await page.getByTestId("create-group-open").click();
  }

  await page.getByTestId("create-group-name").fill(name);
  if (description) await page.getByTestId("create-group-description").fill(description);
  await page.getByTestId("create-group-submit").click();
}

async function mockAgent(page: Page) {
  await page.route("**/api/agent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Drafted a BBQ proposal with deterministic itemized calculation.",
        nextActions: ["review_proposal", "send_proposal"],
        trace: [
          { agent: "Orchestrator Agent", action: "initialize_workflow", status: "completed", detail: "Received organizer message." },
          { agent: "Intake Agent", action: "extract_expense_context", status: "completed", detail: "Parsed BBQ demo." },
          { agent: "Split Planning Agent", action: "choose_strategy", status: "completed", detail: "Using itemized deterministic split." }
        ]
      })
    });
  });
}

test("home creates and persists a default group", async ({ page }) => {
  await clearDemoStorage(page);

  await expect(page.getByTestId("home-route")).toBeVisible();
  if (!isMobile(page)) {
    await expect(page.getByTestId("group-switcher")).toContainText("BBQ Crew");
  }
  await expect(page.getByText("Open BBQ Crew")).toBeVisible();

  await page.goto("/groups/bbq-crew/chat");
  await expect(page.getByTestId("chat-route")).toBeVisible();
});

test("mobile sidebar opens from hamburger and left-edge swipe", async ({ page }) => {
  test.skip(!isMobile(page), "Mobile-only sidebar gesture coverage");
  await clearDemoStorage(page);

  await page.goto("/groups/bbq-crew/chat");
  await expect(page.getByTestId("mobile-swipe-hint")).toBeVisible();
  await page.getByTestId("mobile-sidebar-open").click();
  await expect(page.getByTestId("mobile-sidebar-overlay")).toBeVisible();
  await page.getByLabel("Close sidebar").click();

  await openMobileSidebarWithEdgeSwipe(page);
  await expect(page.getByTestId("mobile-sidebar-overlay").getByTestId("sidebar-group-list")).toContainText("BBQ Crew");
});

test("user can create a group and switch between group-scoped workspaces", async ({ page }) => {
  await clearDemoStorage(page);

  await createGroup(page, "Jeju Trip", "Trip settlement workspace");

  await expect(page).toHaveURL(/\/groups\/jeju-trip\/chat/);
  if (isMobile(page)) {
    await openMobileSidebarIfNeeded(page);
    await expect(page.getByTestId("mobile-sidebar-overlay").getByTestId("sidebar-group-list")).toContainText("Jeju Trip");
    await page.getByTestId("mobile-sidebar-overlay").getByTestId("sidebar-group-bbq-crew").click();
    await page.getByTestId("mobile-sidebar-overlay").getByTestId("sidebar-chat-chat-bbq-intake").click();
  } else {
    await expect(page.getByTestId("group-switcher")).toContainText("Jeju Trip");
    await expect(page.getByTestId("sidebar-group-list")).toContainText("Jeju Trip");
  }
  await expect(page.getByTestId("chat-route")).toBeVisible();

  await page.goto("/groups/jeju-trip");
  await expect(page.getByTestId("group-overview-route")).toBeVisible();

  await page.goto("/groups/jeju-trip/proposals");
  await expect(page.getByTestId("proposal-empty-state")).toBeVisible();

  if (isMobile(page)) {
    await page.goto("/groups/bbq-crew/chat");
  } else {
    await page.getByTestId("group-switcher").click();
    await page.getByTestId("group-switcher-menu").getByTestId("group-switcher-option-bbq-crew").click();
  }
  await expect(page).toHaveURL(/\/groups\/bbq-crew\/chat/);
  await page.goto("/groups/bbq-crew/proposals");
  await expect(page.getByText("BBQ Dinner").first()).toBeVisible();
});

test("group chat creates artifacts and sends a proposal from the sticky panel footer", async ({ page }) => {
  await mockAgent(page);
  await clearDemoStorage(page);

  await page.goto("/groups/bbq-crew/chat");
  await page.getByTestId("chat-input").fill(bbqPrompt);
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("artifact-preview-proposal_draft")).toBeVisible();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("BBQ Dinner parser review");
  if (isMobile(page)) {
    const panelBox = await page.getByTestId("workspace-detail-panel").boundingBox();
    const viewport = page.viewportSize();
    expect(panelBox?.width).toBeGreaterThanOrEqual((viewport?.width ?? 0) - 16);
    expect(panelBox?.height).toBeGreaterThanOrEqual((viewport?.height ?? 0) - 16);
  } else {
    await expect(page.getByTestId("workspace-detail-panel")).toContainText("Settlement plan");
  }
  await expect(page.getByTestId("workspace-panel-footer")).toBeVisible();
  await page.getByTestId("panel-send-proposal").click();

  await page.goto("/groups/bbq-crew/proposals");
  await page.getByTestId("proposal-row-bbq-dinner").click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Waiting For Responses");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Settlement plan");
});

test("chat asks clarification for mismatched parsed totals", async ({ page }) => {
  await mockAgent(page);
  await clearDemoStorage(page);

  await page.goto("/groups/bbq-crew/chat");
  await clickNewChat(page);
  await page.getByTestId("chat-input").fill("BBQ for 8 people. Total was 128,000 won. Meat was 80k and drinks 20k.");
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("chat-messages")).toContainText("need clarification");
  await expect(page.getByTestId("chat-messages")).toContainText("itemized costs add up");
});

test("chat parses pasted receipt-like text into reviewable artifacts", async ({ page }) => {
  await mockAgent(page);
  await clearDemoStorage(page);

  await page.goto("/groups/bbq-crew/chat");
  await clickNewChat(page);
  await page.getByTestId("chat-input").fill(`BBQ Crew
Meat 64,000
Drinks 24,000
Charcoal 10,000
Sides 30,000
Total 128,000
8 people
Daniel no beef`);
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("artifact-preview-parser_review")).toBeVisible();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Mode: receipt_text");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Detected items: Meat");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Daniel excluded from meat");
});

test("ambiguous allocation opens resolver and equal allocation creates proposal", async ({ page }) => {
  await mockAgent(page);
  await clearDemoStorage(page);

  await page.goto("/groups/bbq-crew/chat");
  await clickNewChat(page);
  await page.getByTestId("chat-input").fill("Dinner and drinks were 120k for 5 people. Daniel did not drink.");
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("artifact-preview-allocation_resolution")).toBeVisible();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Allocation resolution needed");
  await page.getByTestId("panel-use-equal-allocation").click();

  await expect(page.getByTestId("artifact-preview-proposal_draft")).toBeVisible();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Allocation: single_total_equal_items");
  await page.getByTestId("panel-send-proposal").click();
  await page.goto("/groups/bbq-crew/proposals");
  await expect(page.getByText("Dinner").first()).toBeVisible();
});

test("claimed prior payment can be confirmed before it affects settlement", async ({ page }) => {
  await mockAgent(page);
  await clearDemoStorage(page);

  await page.goto("/groups/bbq-crew/chat");
  await clickNewChat(page);
  await page.getByTestId("chat-input").fill("Movie night: I paid 72,000 for tickets and 24,000 for snacks. Daniel skipped snacks. Sarah already paid me 10,000.");
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("artifact-preview-settlement_ledger")).toBeVisible();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Credit: Sarah already paid Organizer ₩10,000");
  await page.getByTestId("panel-confirm-credit").click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("confirmed");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Confirmed paid: ₩10,000");
});

test("participant change request is prioritized and can be settled through proposal detail", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/bbq-crew/inbox");
  await page.getByTestId("participant-switch-daniel").click();
  await expect(page.getByTestId("participant-inbox-card")).toContainText("BBQ Dinner");
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Meat");
  await page.getByTestId("change-reason-input").fill("I did not eat beef");
  await page.getByTestId("participant-request-changes").click();

  await page.goto("/");
  await expect(page.getByText("Urgent changes")).toBeVisible();
  await expect(page.getByText("BBQ Dinner").first()).toBeVisible();

  await page.goto("/groups/bbq-crew/proposals/bbq-dinner");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Participant balances");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Settlement plan");
  await page.getByTestId("panel-accept-change").click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Needs Reconfirmation");
  await page.getByTestId("panel-mark-settled").click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Settled");

  await page.reload();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Settled");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Settlement plan");
});

test("chat retention keeps the newest three chats per group", async ({ page }) => {
  await clearDemoStorage(page);
  await page.goto("/groups/bbq-crew/chat");

  await clickNewChat(page);
  await clickNewChat(page);
  await clickNewChat(page);
  await clickNewChat(page);

  if (isMobile(page)) await openMobileSidebarIfNeeded(page);
  const chatList = isMobile(page) ? page.getByTestId("mobile-sidebar-overlay").getByTestId("chat-session-list") : page.getByTestId("chat-session-list");
  await expect(chatList.getByRole("button")).toHaveCount(3);
  await page.reload();
  if (isMobile(page)) await openMobileSidebarIfNeeded(page);
  const reloadedChatList = isMobile(page) ? page.getByTestId("mobile-sidebar-overlay").getByTestId("chat-session-list") : page.getByTestId("chat-session-list");
  await expect(reloadedChatList.getByRole("button")).toHaveCount(3);
});

test("reset demo data clears extra groups and restores canonical workspace", async ({ page }) => {
  await clearDemoStorage(page);

  await createGroup(page, "Temporary Review Group");
  if (!isMobile(page)) {
    await expect(page.getByTestId("group-switcher")).toContainText("Temporary Review Group");
  }

  await page.goto("/groups/temporary-review-group/chat");
  await resetDemoData(page);
  if (!isMobile(page)) {
    await expect(page.getByTestId("group-switcher")).toContainText("BBQ Crew");
  }
  await page.goto("/groups");
  await expect(page.getByText("Temporary Review Group")).toHaveCount(0);
  await expect(page.getByTestId("groups-route").getByText("BBQ Crew").first()).toBeVisible();
});

test("proposal search and filters are group-scoped", async ({ page }) => {
  await clearDemoStorage(page);
  await page.goto("/groups/bbq-crew/proposals");

  await expect(page.getByText("BBQ Dinner").first()).toBeVisible();
  await page.getByTestId("proposal-search").fill("Daniel");
  await expect(page.getByText("BBQ Dinner").first()).toBeVisible();
  await page.getByTestId("proposal-search").fill("not-a-match");
  await expect(page.getByTestId("proposal-empty-state")).toBeVisible();
  await page.getByTestId("proposal-search").fill("");
  await page.getByTestId("proposal-filter-paid").click();
  await expect(page.getByTestId("proposal-empty-state")).toBeVisible();
});

test("agent lab runs orchestrator scenario without layout overflow", async ({ page }) => {
  await page.goto("/agent-lab");
  await expect(page.getByTestId("agent-lab-route")).toBeVisible();
  await page.getByRole("button", { name: "Run" }).click();
  await expect(page.getByText("Orchestrator message")).toBeVisible();
  await expect(page.getByText("Busan Airbnb").first()).toBeVisible();
  await expect(page.getByText("Risk", { exact: true })).toBeVisible();
  await expect(page.getByText("Trace", { exact: true })).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
