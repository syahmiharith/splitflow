import { expect, test, type Browser, type Page } from "@playwright/test";
import nextEnv from "@next/env";
import path from "node:path";
nextEnv.loadEnvConfig(process.cwd());
// Explicit opt-in uses only the isolated config.toml stack and its captured email.
test.skip(
  process.env.PILOT_LIVE_LOCAL !== "1",
  "Requires the isolated local Supabase stack.",
);
test.describe.configure({ mode: "serial" });
if (
  process.env.PILOT_LIVE_LOCAL === "1" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:55421"
)
  throw new Error("Live local tests require the isolated Supabase config.");
const mail = "http://127.0.0.1:55424";
const run = () => `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
async function signIn(page: Page, email: string, path = "/") {
  await page.goto(path);
  await page.getByLabel("Email", { exact: true }).fill(email);
  const existing = await (
    await page.request.get(
      `${mail}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    )
  ).json();
  const previousId = existing.messages[0]?.ID;
  await page
    .getByRole("button", { name: "Send email code", exact: true })
    .click();
  let code = "";
  await expect(async () => {
    const search = await page.request.get(
      `${mail}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
    );
    const messages = await search.json();
    expect(messages.messages.length).toBeGreaterThan(0);
    expect(messages.messages[0].ID).not.toBe(previousId);
    const message = await (
      await page.request.get(
        `${mail}/api/v1/message/${messages.messages[0].ID}`,
      )
    ).json();
    code = (message.Text || message.HTML || "").match(/\b\d{6}\b/)?.[0] ?? "";
    expect(code).toHaveLength(6);
  }).toPass({ timeout: 30000 });
  await page.getByLabel("Email code", { exact: true }).fill(code);
  await page.getByRole("button", { name: "Verify code", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign out", exact: true }),
  ).toBeVisible();
}
async function newDinner(
  page: Page,
  emails: string[],
  title: string,
  total = 60000,
) {
  await page.getByRole("link", { name: "New split", exact: true }).first().click();
  await page.getByLabel("Title", { exact: true }).fill(title);
  for (let index = 1; index < emails.length; index++) {
    if (index > 1)
      await page
        .getByRole("button", { name: "Add participant", exact: true })
        .click();
    await page
      .getByLabel("Name", { exact: true })
      .nth(index)
      .fill(`Guest ${index}`);
    await page
      .getByLabel("Email", { exact: true })
      .nth(index)
      .fill(emails[index]);
  }
  await page.getByLabel("Total (KRW)", { exact: true }).fill(String(total));
}
async function publish(page: Page) {
  await page.getByRole("button", { name: "Review split", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish split", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toHaveText("Saved.");
}
async function invitation(page: Page, name: string) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page
    .getByRole("button", { name: `Copy invitation for ${name}`, exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    "Invitation for",
  );
  return page.evaluate(() => navigator.clipboard.readText());
}
async function guest(browser: Browser, page: Page) {
  const context = await browser.newContext({
    viewport: page.viewportSize() ?? { width: 1280, height: 900 },
  });
  return { context, page: await context.newPage() };
}
test("real OTP, email-bound invitation, persisted dinner and unrelated-account denial", async ({
  page,
  browser,
}) => {
  const id = run();
  const emails = [
    `organizer-${id}@example.test`,
    `guest-${id}@example.test`,
    `friend-${id}@example.test`,
  ];
  await signIn(page, emails[0]);
  await newDinner(page, emails, "Shared dinner");
  await publish(page);
  await expect(
    page.getByText("Your share ₩20,000", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Report a problem", exact: true })
    .click();
  await page
    .getByLabel("What did you expect?")
    .fill("A clear repayment recipient");
  await page
    .getByLabel("What happened?")
    .fill("Synthetic pilot feedback check");
  await page
    .getByRole("button", { name: "Save report privately", exact: true })
    .click();
  await expect(
    page.getByText("Report saved privately.", { exact: true }),
  ).toBeVisible();
  const persistedSplitId = await page.evaluate(async () => {
    const token = JSON.parse(
      localStorage.getItem("splitflow-pilot-session")!,
    ).access_token;
    const rows = await (
      await fetch("/api/pilot", {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    return rows[0].id as string;
  });
  await expect(async () => {
    const response = await page.request.get(
      `${process.env.SUPABASE_URL}/rest/v1/pilot_creation_measurements?split_id=eq.${persistedSplitId}&select=id,started_at,published_at,used_ai`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      },
    );
    const rows = await response.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0].published_at).toBeTruthy();
    expect(rows[0].used_ai).toBe(false);
  }).toPass({ timeout: 10000 });
  if (process.env.PILOT_EVIDENCE_DIR)
    await page.screenshot({
      path: path.join(
        process.env.PILOT_EVIDENCE_DIR,
        `dinner-${test.info().project.name}.png`,
      ),
      fullPage: true,
    });
  const link = await invitation(page, "Guest 1");
  const participant = await guest(browser, page);
  await signIn(participant.page, emails[1], link);
  await expect(
    participant.page.getByText("Your share ₩20,000", { exact: true }),
  ).toBeVisible();
  await participant.page.reload();
  await expect(
    participant.page.getByText("Your share ₩20,000", { exact: true }),
  ).toBeVisible();
  await participant.page
    .getByText("How your share was calculated", { exact: true })
    .click();
  await expect(
    participant.page.getByText("Dinner · ₩60,000 · Your share ₩20,000", {
      exact: false,
    }),
  ).toBeVisible();
  const previousRefresh = await participant.page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem("splitflow-pilot-session")!);
    const previous = stored.refresh_token;
    stored.expires_at = 0;
    localStorage.setItem("splitflow-pilot-session", JSON.stringify(stored));
    return previous;
  });
  await participant.page.reload();
  await expect(
    participant.page.getByText("Your share ₩20,000", { exact: true }),
  ).toBeVisible();
  expect(
    await participant.page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("splitflow-pilot-session")!)
          .refresh_token,
    ),
  ).not.toBe(previousRefresh);
  const stranger = await guest(browser, page);
  await signIn(stranger.page, `stranger-${id}@example.test`, link);
  await expect(stranger.page.getByRole("status").first()).toContainText(
    "Sign in with the email",
  );
  const strangerToken = await stranger.page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("splitflow-pilot-session")!).access_token,
  );
  const rows = await stranger.page.request.get(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/pilot_splits?select=id`,
    {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${strangerToken}`,
      },
    },
  );
  expect(rows.ok()).toBe(true);
  expect(await rows.json()).toEqual([]);
  await participant.context.close();
  await stranger.context.close();
});

test("real outing with exclusions and two payers reconciles after reload", async ({
  page,
}) => {
  const id = run();
  const emails = [
    `outing-${id}@example.test`,
    `payer-${id}@example.test`,
    `excluded-${id}@example.test`,
  ];
  await signIn(page, emails[0]);
  await newDinner(page, emails, "Outing with exceptions", 60001);
  await page
    .getByLabel("Item exclusions, custom shares or multiple payers")
    .check();
  await page.getByLabel("Paid or committed (KRW)").nth(0).fill("40001");
  await page.getByLabel("Paid or committed (KRW)").nth(1).fill("20000");
  await page.getByLabel("Amount (KRW)", { exact: true }).fill("60001");
  await page.getByRole("checkbox", { name: "Guest 2", exact: true }).uncheck();
  await publish(page);
  await expect(
    page.getByText("Your share ₩30,001", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Your share ₩30,001", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Participants and shares" }).getByRole("listitem").filter({ hasText: "Guest 2" }).getByText("₩0", { exact: true }),
  ).toBeVisible();
});

test("real reported repayment, receipt and revision retain history and expose overpayment", async ({
  page,
  browser,
}) => {
  const id = run();
  const emails = [`revision-${id}@example.test`, `sender-${id}@example.test`];
  await signIn(page, emails[0]);
  await newDinner(page, emails, "Dinner corrected later");
  await publish(page);
  const link = await invitation(page, "Guest 1");
  const participant = await guest(browser, page);
  await signIn(participant.page, emails[1], link);
  await expect(
    participant.page.getByText("Your share ₩30,000", { exact: true }),
  ).toBeVisible();
  await participant.page.getByLabel("Amount sent (KRW)").fill("30000");
  await participant.page
    .getByRole("button", { name: "Report sent", exact: true })
    .click();
  await expect(
    participant.page.getByText("Reported sent", { exact: false }),
  ).toBeVisible();
  await expect(
    participant.page.getByText("Your remaining balance ₩30,000", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Confirm received", exact: true })
    .click();
  await expect(
    page.getByText("Confirmed received", { exact: false }),
  ).toBeVisible();
  await participant.page.reload();
  await expect(
    participant.page.getByText("Your remaining balance ₩0", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revise expense", exact: true })
    .click();
  await page.getByLabel("Amount (KRW)", { exact: true }).fill("30000");
  await page.getByLabel("Paid or committed (KRW)").nth(0).fill("30000");
  await page.getByLabel("Reason for change").fill("Corrected receipt total");
  await publish(page);
  await participant.page.reload();
  await expect(
    participant.page.getByText("Still owed to you ₩15,000", { exact: true }),
  ).toBeVisible();
  await expect(
    participant.page.getByText("Confirmed received", { exact: false }),
  ).toBeVisible();
  await participant.context.close();
});

test("background refresh cannot advance the revision of an open organizer draft", async ({
  page,
  browser,
}) => {
  const id = run();
  const emails = [`concurrent-${id}@example.test`, `guest-${id}@example.test`];
  await signIn(page, emails[0]);
  await newDinner(page, emails, "Concurrent dinner");
  await publish(page);
  await page
    .getByRole("button", { name: "Revise expense", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("My older draft");
  await page.getByLabel("Reason for change").fill("Older session edit");
  const other = await guest(browser, page);
  await signIn(other.page, emails[0]);
  await other.page.goto("/?view=splits");
  await other.page.getByRole("link", { name: /Concurrent dinner/ }).click();
  await other.page
    .getByRole("button", { name: "Revise expense", exact: true })
    .click();
  await other.page
    .getByLabel("Title", { exact: true })
    .fill("Newer organizer edit");
  await other.page.getByLabel("Reason for change").fill("Latest session edit");
  await publish(other.page);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByText(
      "This split changed. Review the latest amounts before responding. An open revision keeps its original version.",
    ),
  ).toBeVisible();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "My older draft",
  );
  await page.getByRole("button", { name: "Review split", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish split", exact: true })
    .click();
  await expect(page.getByRole("status").first()).toContainText(
    "This split changed",
  );
  await other.page.reload();
  await expect(
    other.page.getByRole("heading", {
      name: "Newer organizer edit",
      exact: true,
    }),
  ).toBeVisible();
  await other.context.close();
});

test("planned allocations require renewed review after a change", async ({
  page,
  browser,
}) => {
  const id = run();
  const emails = [
    `planned-${id}@example.test`,
    `participant-${id}@example.test`,
  ];
  await signIn(page, emails[0]);
  await newDinner(page, emails, "Planned outing");
  await page.getByLabel("Expense type").selectOption("planned");
  await publish(page);
  const link = await invitation(page, "Guest 1");
  const participant = await guest(browser, page);
  await signIn(participant.page, emails[1], link);
  await participant.page
    .getByRole("button", { name: "Accept participation", exact: true })
    .click();
  await expect(participant.page.getByRole("status").first()).toHaveText(
    "Saved.",
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Revise expense", exact: true })
    .click();
  await page.getByLabel("Amount (KRW)", { exact: true }).fill("30000");
  await page.getByLabel("Paid or committed (KRW)").nth(0).fill("30000");
  await page.getByLabel("Reason for change").fill("Updated plan");
  await publish(page);
  await participant.page.evaluate(() =>
    window.dispatchEvent(new Event("focus")),
  );
  await expect(
    participant.page.getByText("Your share ₩15,000", { exact: true }),
  ).toBeVisible();
  await participant.page
    .getByRole("button", { name: "Accept participation", exact: true })
    .click();
  await expect(participant.page.getByRole("status").first()).toContainText(
    "This split changed",
  );
  await participant.page
    .getByRole("button", { name: "I have reviewed this version", exact: true })
    .click();
  await participant.page
    .getByRole("button", { name: "Accept participation", exact: true })
    .click();
  await expect(participant.page.getByRole("status").first()).toHaveText(
    "Saved.",
  );
  await participant.context.close();
});
