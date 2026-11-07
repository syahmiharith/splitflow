import { expect, test, type Page } from "@playwright/test";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
test.skip(
  process.env.PILOT_LIVE_LOCAL !== "1",
  "Requires isolated local Supabase.",
);
if (
  process.env.PILOT_LIVE_LOCAL === "1" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55421"
)
  throw new Error("Local-only fixture");
async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Send email code", exact: true })
    .click();
  let code = "";
  await expect(async () => {
    const rows = await (
      await page.request.get(
        `http://127.0.0.1:55424/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      )
    ).json();
    expect(rows.messages.length).toBeGreaterThan(0);
    const mail = await (
      await page.request.get(
        `http://127.0.0.1:55424/api/v1/message/${rows.messages[0].ID}`,
      )
    ).json();
    code = (mail.Text || mail.HTML || "").match(/\b\d{6}\b/)?.[0] ?? "";
    expect(code).toHaveLength(6);
  }).toPass({ timeout: 30000 });
  await page.getByLabel("Email code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "What are we splitting?" }),
  ).toBeVisible();
}
test("private draft and published conversation recover in independent signed-in sessions", async ({
  page,
  browser,
}) => {
  const run = `${Date.now()}-${test.info().project.name}`;
  const email = `conversation-${run}@example.test`;
  await signIn(page, email);
  await page
    .getByRole("button", { name: "Enter manually", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Title", { exact: true })
    .fill("Saved dinner conversation");
  await modal.getByLabel("Name", { exact: true }).nth(1).fill("Minji");
  await modal
    .getByLabel("Email", { exact: true })
    .nth(1)
    .fill(`minji-${run}@example.test`);
  await modal.getByLabel("Total (KRW)", { exact: true }).fill("60000");
  await modal
    .getByRole("button", { name: "Review split", exact: true })
    .click();
  await modal.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(modal).not.toBeVisible();
  await expect(page).toHaveURL(/conversation=/);
  const url = page.url();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Current split preview" }),
  ).toContainText("Saved dinner conversation");
  const session = await page.evaluate(() =>
    localStorage.getItem("splitflow-pilot-session"),
  );
  const owner = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
  });
  const second = await owner.newPage();
  await second.addInitScript(
    (value) => localStorage.setItem("splitflow-pilot-session", value!),
    session,
  );
  await second.goto(url);
  await expect(
    second.getByRole("region", { name: "Current split preview" }),
  ).toContainText("₩30,000");
  const accountToken = JSON.parse(session!).access_token;
  const request = {
    id: new URL(url).searchParams.get("conversation"),
    key: crypto.randomUUID(),
    expected: 1,
    message: "Persist this context even when drafting is unavailable.",
  };
  // Exercise the actual conversation API, keeping provider failure separate from successful financial publication.
  const saved = await page.request.post("/api/pilot/conversations", {
    headers: { Authorization: `Bearer ${accountToken}` },
    data: request,
  });
  expect(saved.ok()).toBe(true);
  const chat = await saved.json();
  expect(
    chat.messages.some(
      (m: { content: string }) => m.content === request.message,
    ),
  ).toBe(true);
  await second.reload();
  await expect(second.getByRole("log")).toContainText(request.message);
  await second
    .getByRole("button", { name: "Review split", exact: true })
    .click();
  await second
    .getByRole("button", { name: "Publish split", exact: true })
    .click();
  await expect(
    second.getByText("Published split", { exact: true }),
  ).toBeVisible();
  await second.reload();
  await expect(
    second.getByRole("link", { name: "Open split details" }),
  ).toBeVisible();
  const unrelated = await browser.newContext({
    viewport: page.viewportSize() ?? undefined,
  });
  const stranger = await unrelated.newPage();
  await signIn(stranger, `unrelated-${run}@example.test`);
  await stranger.goto(url);
  await expect(
    stranger.getByText("This conversation is unavailable for your account.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    stranger.getByRole("region", { name: "Current split preview" }),
  ).toHaveCount(0);
  await owner.close();
  await unrelated.close();
});
