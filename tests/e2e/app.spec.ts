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
  await expect(page.getByText("participants are still pending")).toBeVisible();
});

test("chat handles mocked AI unavailable state without breaking workflow", async ({ page }) => {
  await page.route("**/api/ai/split-agent", async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "AI unavailable." }) });
  });

  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Create an Airbnb split");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("ai-unavailable")).toBeVisible();
});

test("mobile layout keeps core surfaces reachable", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile project only");
  await page.goto("/chat");
  await expect(page.getByTestId("chat-route")).toBeVisible();
  await expect(page.getByLabel("Mobile navigation")).toBeVisible();
});
