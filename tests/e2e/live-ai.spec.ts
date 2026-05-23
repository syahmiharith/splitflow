import { expect, test } from "@playwright/test";

test("optional live AI smoke", async ({ page }) => {
  test.skip(!process.env.OPENAI_API_KEY, "OPENAI_API_KEY is required for live AI smoke.");

  await page.goto("/groups/jeju-trip/chat");
  await page.getByTestId("chat-input").fill("Create a trip split for taxi fare of ₩40000 split equally between Syahmi and Mina.");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("ai-unavailable")).toHaveCount(0);
});
