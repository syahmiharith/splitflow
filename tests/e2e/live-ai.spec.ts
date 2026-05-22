import { expect, test } from "@playwright/test";

test("optional live AI smoke", async ({ page }) => {
  test.skip(!process.env.OPENAI_API_KEY, "OPENAI_API_KEY is required for live AI smoke.");

  await page.goto("/chat");
  await page.getByTestId("chat-input").fill("Create a proposal for taxi fare of ₩40000 split equally between You and Ali.");
  await page.getByTestId("chat-send").click();
  await expect(page.getByTestId("ai-unavailable")).toHaveCount(0);
});
