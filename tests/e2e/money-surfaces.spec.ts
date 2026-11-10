import { test, expect } from "@playwright/test";

test("group money, personal shares and balances remain compact with conversation handoffs", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  const group = page.locator(".sf-group-money-row");
  await expect(group).toContainText("Friends & housemates");
  await expect(group).toContainText("You’re owed ₩40,000");
  await expect(page.getByLabel("Message SplitFlow")).toBeVisible();
  if (test.info().project.name === "mobile") await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "Your splits", exact: true }).filter({ visible: true }).click();
  const overview = page.getByRole("region", { name: "Money overview" });
  const dinner = overview.getByRole("button").filter({ hasText: "Dinner" });
  await expect(dinner).toContainText("Your share₩20,000₩60,000 total");
  await expect(dinner).toContainText("You get ₩40,000");
  for (const width of [320,375,768,1440]) {
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(overview.getByRole("button", {name:"Planning",exact:true})).toBeInViewport();
  }
  await overview.getByRole("button", {name:"Balances",exact:true}).click();
  await expect(overview).toContainText("Gets back");
  await expect(overview.getByRole("button").filter({hasText:"Minji → Alex"})).toContainText("₩20,000");
  await overview.getByRole("button").filter({hasText:"Minji → Alex"}).click();
  await expect(page.getByLabel("Message SplitFlow")).toBeVisible();
  await expect(page.getByRole("article",{name:"Dinner expense"})).toBeFocused();
});
