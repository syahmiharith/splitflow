import { test, expect } from "@playwright/test";

test("conversation search opens the existing activity and reports empty results", async ({ page }) => {
  await page.goto("/");
  if (test.info().project.name === "mobile") await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Search conversations", exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search conversations", exact: true });
  const search = dialog.getByLabel("Search conversation titles");
  await expect(search).toBeFocused();
  await search.fill("nothing-matches-this");
  await expect(dialog.getByRole("status")).toContainText("No conversations found");
  await search.fill("household");
  await expect(dialog.getByRole("button", { name: "Household rent Activity" })).toBeVisible();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Household rent", exact: true })).toBeVisible();
});

test("composer popover dismisses, returns focus and opens manual entry without losing text", async ({ page }) => {
  await page.goto("/");
  const input = page.getByLabel("Message SplitFlow");
  await input.fill("Plan dinner with friends");
  const trigger = page.getByRole("button", { name: "Enter manually", exact: true });
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "Enter manually", exact: true });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole("button", { name: "Plan an activity", exact: true }).click();
  await expect(menu).toBeHidden();
  await expect(page.getByRole("region", { name: "New activity", exact: true })).toBeVisible();
  await expect(input).toHaveValue("Plan dinner with friends");
});

test("friend filtering and share access rows remain readable at narrow widths", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await page.locator(".sf-friends-disclosure > summary").click();
  const friends = page.getByRole("region", { name: "Friends", exact: true });
  await friends.getByLabel("Search friends").fill("minji");
  await expect(friends.getByText("Minji", { exact: true })).toBeVisible();
  await expect(friends.getByText("Sam", { exact: true })).toHaveCount(0);
  await friends.getByLabel("Search friends").fill("nobody-matches");
  await expect(friends.getByRole("status")).toHaveText("No matching friends.");
  if (test.info().project.name === "mobile") await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Search conversations", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Weekend together Activity" }).click();
  await expect(friends).toBeHidden();
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  await page.getByRole("button", { name: "People & share", exact: true }).click();
  const share = page.getByRole("region", { name: "People & share", exact: true });
  await expect(share.getByRole("button", { name: "Copy invitation link" })).toBeVisible();
  await share.getByText("Who can open this?", { exact: false }).click();
  await expect(share.getByText("minji@example.test", { exact: true })).toBeVisible();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(share).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(share.getByRole("button", { name: "Copy invitation link" })).toBeInViewport();
  }
});
