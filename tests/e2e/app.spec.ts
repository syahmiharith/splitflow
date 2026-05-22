import { expect, test } from "@playwright/test";

test("sidebar navigation and chat shell render", async ({ page }) => {
  await page.goto("/chat");
  await expect(page.getByTestId("chat-route")).toBeVisible();
  await expect(page.getByTestId("draft-proposal-card")).toBeVisible();
  await expect(page.getByTestId("right-workflow-panel")).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByTestId("dashboard-route")).toBeVisible();
});

test("participant can request changes and dashboard updates", async ({ page }) => {
  await page.goto("/inbox");
  await page.getByTestId("participant-request-changes").click();
  await expect(page.getByText("Requested Changes").first()).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByTestId("dashboard-route")).toBeVisible();
  await expect(page.getByText("Review participant change request.").first()).toBeVisible();
});

test("chat handles mocked AI unavailable state without breaking workflow", async ({ page }) => {
  await page.route("**/api/agent", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Agent unavailable." }) });
  });

  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Create an Airbnb split");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("ai-unavailable")).toBeVisible();
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

test("mobile layout keeps core surfaces reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile project only");
  await page.goto("/chat");
  await expect(page.getByTestId("chat-route")).toBeVisible();
  await expect(page.getByLabel("Mobile navigation")).toBeVisible();
});

test("full prototype BBQ agreement flow", async ({ page }) => {
  await page.route("**/api/agent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Drafted a BBQ proposal with deterministic itemized calculation.",
        nextActions: ["review_proposal", "send_proposal"],
        trace: [
          { agent: "Orchestrator Agent", action: "initialize_workflow", status: "completed", detail: "Received organizer message." },
          { agent: "Intake Agent", action: "extract_expense_context", status: "completed", detail: "Parsed BBQ demo." }
        ]
      })
    });
  });
  await page.goto("/chat");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByTestId("chat-input").fill("BBQ dinner for 8. I paid ₩64,000 meat, Ali paid ₩24,000 drinks, Sarah paid ₩10,000 charcoal, sides were ₩30,000. Daniel did not eat beef.");
  await page.getByTestId("chat-send").click();

  await expect(page.getByTestId("draft-proposal-card")).toContainText("BBQ Dinner");
  await expect(page.getByTestId("cost-items-panel")).toContainText("Meat");
  await expect(page.getByTestId("calculation-audit")).toContainText("Meat:");
  await page.getByTestId("send-proposal").click();

  await page.goto("/inbox");
  await page.getByTestId("participant-switch-daniel").click();
  await expect(page.getByTestId("participant-inbox-card")).toContainText("BBQ Dinner");
  await page.getByTestId("change-reason-input").fill("I did not eat beef");
  await page.getByTestId("participant-request-changes").click();

  await page.goto("/dashboard");
  await expect(page.getByText("Review participant change request.").first()).toBeVisible();
  await page.getByText("BBQ Dinner").first().click();

  await expect(page.getByTestId("proposal-detail-route")).toContainText("Itemized math");
  await expect(page.getByTestId("change-requests")).toContainText("I did not eat beef");
  await page.getByTestId("detail-accept-change").click();
  await expect(page.getByTestId("settlement-plan")).toContainText("pays");
  await page.getByTestId("detail-mark-settled").click();
  await expect(page.getByTestId("proposal-detail-route")).toContainText("Settled");
});
