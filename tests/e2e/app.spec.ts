import { expect, test, type Page } from "@playwright/test";

function isMobile(page: Page) {
  return (page.viewportSize()?.width ?? 1024) < 768;
}

async function clearDemoStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
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

test("home creates and persists the Jeju trip workspace", async ({ page }) => {
  await clearDemoStorage(page);

  await expect(page.getByTestId("home-route")).toBeVisible();
  if (!isMobile(page)) {
    await expect(page.getByTestId("group-switcher")).toContainText("Jeju Trip");
  }
  await expect(page.getByText("Open Jeju Trip")).toBeVisible();

  await page.goto("/groups/jeju-trip/chat");
  await expect(page.getByTestId("chat-route")).toBeVisible();
  await expect(page.getByTestId("safe-to-book-summary")).toContainText("Review Before Sending");
  await expect(page.getByTestId("readiness-checklist")).toContainText("Ready Check");
  await expect(page.getByTestId("artifact-preview-proposal_draft")).toContainText("Jeju Airbnb Trip Split");
});

test("mobile sidebar opens from hamburger and left-edge swipe", async ({ page }) => {
  test.skip(!isMobile(page), "Mobile-only sidebar gesture coverage");
  await clearDemoStorage(page);

  await page.goto("/groups/jeju-trip/chat");
  await expect(page.getByTestId("mobile-swipe-hint")).toBeVisible();
  await page.getByTestId("mobile-sidebar-open").click();
  await expect(page.getByTestId("mobile-sidebar-overlay")).toBeVisible();
  await page.getByLabel("Close sidebar").click();

  await openMobileSidebarWithEdgeSwipe(page);
  await expect(page.getByTestId("mobile-sidebar-overlay").getByTestId("sidebar-group-list")).toContainText("Jeju Trip");
});

test("chat preview opens Trip Split and sends Your Share", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/jeju-trip/chat");
  await page.getByTestId("artifact-preview-proposal_draft").click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Review Before Sending");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Everyone's share");
  await page.getByTestId("panel-send-proposal").click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Still Waiting");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Sent Your Share to friends for review.");
  await expect(page.getByTestId("share-preview-message")).toContainText("Open it to tap I'm In");
});

test("friend can review Your Share and tap I'm In", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/jeju-trip/inbox");
  await page.getByTestId("participant-switch-mina").click();
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Jeju Airbnb Trip Split");
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Your share");
  await expect(page.getByTestId("participant-share-explanation")).toContainText("Why this share?");
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Friday night Airbnb");
  await page.getByTestId("participant-accept").click();
  await expect(page.getByTestId("participant-inbox-card")).toContainText("I'm In");
});

test("change request updates organizer ready check and requires reconfirmation", async ({ page }) => {
  await clearDemoStorage(page);

  await page.goto("/groups/jeju-trip/inbox");
  await page.getByTestId("participant-switch-alex").click();
  await page.getByTestId("change-reason-input").fill("Alex is only joining Saturday night.");
  await page.getByTestId("participant-request-changes").click();
  await expect(page.getByTestId("participant-inbox-card")).toContainText("Asked for a Change");

  await page.goto("/groups/jeju-trip/proposals");
  await page.getByTestId("proposal-row-jeju-airbnb-trip").first().click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Alex asked for a change");
  await page.getByTestId("panel-accept-change").click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Check Again");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Accepted participant change request.");
  await expect(page.getByTestId("workspace-detail-panel")).toContainText(/v\d+(?: to | -> )v\d+/);
});

test("creating a group and resetting data returns to canonical Jeju workspace", async ({ page }) => {
  await clearDemoStorage(page);

  await createGroup(page, "Temporary Review Group");
  if (!isMobile(page)) {
    await expect(page.getByTestId("group-switcher")).toContainText("Temporary Review Group");
  }

  await page.goto("/groups/temporary-review-group/chat");
  await resetDemoData(page);
  if (!isMobile(page)) {
    await expect(page.getByTestId("group-switcher")).toContainText("Jeju Trip");
  }
  await page.goto("/groups");
  await expect(page.getByText("Temporary Review Group")).toHaveCount(0);
  await expect(page.getByTestId("groups-route").getByText("Jeju Trip").first()).toBeVisible();
});

test("group overview leads with next booking actions", async ({ page }) => {
  await clearDemoStorage(page);
  await page.goto("/groups/jeju-trip");

  await expect(page.getByTestId("action-queue")).toBeVisible();
  await expect(page.getByTestId("action-queue")).toContainText("Trip Split is ready to send");
  await expect(page.getByTestId("action-queue")).toContainText("Send Your Share");
});

test("split search and filters are group-scoped", async ({ page }) => {
  await clearDemoStorage(page);
  await page.goto("/groups/jeju-trip/proposals");

  await expect(page.getByText("Jeju Airbnb Trip Split").first()).toBeVisible();
  await page.getByTestId("proposal-row-jeju-airbnb-trip").first().click();
  await expect(page.getByTestId("workspace-detail-panel")).toContainText("Ready Check");
  await page.getByLabel("Close panel").click();
  await page.getByTestId("proposal-search").fill("Alex");
  await expect(page.getByText("Jeju Airbnb Trip Split").first()).toBeVisible();
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
