import { expect, test, type Page } from "@playwright/test";
import { calculateExpense, type Split } from "../../lib/pilot/model";
async function session(page: Page) {
  await page.route("**/api/pilot/conversations", (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route("**/api/pilot/measurements", (route) =>
    route.fulfill({ json: { saved: true } }),
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      "splitflow-pilot-session",
      JSON.stringify({
        access_token: "synthetic-ui-session",
        refresh_token: "synthetic-refresh",
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        email: "a@example.com",
      }),
    ),
  );
}
test("manual dinner review, publish and reload with a simulated storage boundary", async ({
  page,
}) => {
  await session(page);
  let saved: Split | undefined;
  await page.route("**/api/pilot", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: saved ? [saved] : [] });
    const input = route.request().postDataJSON();
    calculateExpense(input.expense);
    saved = {
      id: input.id,
      organizer: "a@example.com",
      revision: 1,
      expense: input.expense,
      responses: {},
      repayments: [],
      audit: [],
    };
    return route.fulfill({ json: saved });
  });
  await page.goto("/?legacy=1");
  await page
    .getByRole("link", { name: "New split", exact: true })
    .first()
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Dinner for three");
  await page.getByLabel("Name", { exact: true }).nth(1).fill("B");
  await page.getByLabel("Email", { exact: true }).nth(1).fill("b@example.com");
  await page.getByRole("button", { name: "Add participant" }).click();
  await page.getByLabel("Name", { exact: true }).nth(2).fill("C");
  await page.getByLabel("Email", { exact: true }).nth(2).fill("c@example.com");
  await page.getByLabel("Total (KRW)").fill("60000");
  await page.getByRole("button", { name: "Review split", exact: true }).click();
  await expect(page.getByText("Review before publishing")).toBeVisible();
  await page
    .getByRole("button", { name: "Publish split", exact: true })
    .click();
  await expect(
    page.getByText("Your share ₩20,000", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() => page.getByRole("main").evaluate((element) => element.scrollTop))
    .toBe(0);
  await page.reload();
  await expect(
    page.getByText("Your share ₩20,000", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});
test("wrong-account invitation retains the link and offers sign out", async ({
  page,
}) => {
  await session(page);
  await page.route("**/api/pilot", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/pilot/invitations", (route) =>
    route.fulfill({
      status: 403,
      json: { error: "Sign in with the email this invitation was sent to." },
    }),
  );
  await page.goto("/pilot#invite=" + "a".repeat(64));
  await expect(page.getByRole("status")).toContainText(
    "Sign in with the email",
  );
  expect(page.url()).toContain("#invite=");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign in with email" }),
  ).toBeVisible();
});
test("failed optional drafting retains the description", async ({ page }) => {
  await session(page);
  await page.route("**/api/pilot", (route) => route.fulfill({ json: [] }));
  await page.route("**/api/pilot/draft", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: "Unable to draft expenses. Your description is retained.",
      },
    }),
  );
  await page.goto("/?legacy=1");
  await page
    .getByRole("link", { name: "New split", exact: true })
    .first()
    .click();
  await page.getByText("Describe expenses", { exact: true }).click();
  await page
    .getByLabel("Expense description")
    .fill("Dinner cost 60000, paid by You");
  await page
    .getByRole("button", { name: "Draft expenses", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "description is retained",
  );
  await expect(page.getByLabel("Expense description")).toHaveValue(
    "Dinner cost 60000, paid by You",
  );
});

test("reload retries an interrupted save with the original operation key", async ({
  page,
}) => {
  await session(page);
  let saved: Split | undefined;
  const keys: string[] = [];
  await page.route("**/api/pilot", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: saved ? [saved] : [] });
    const input = route.request().postDataJSON();
    keys.push(input.key);
    if (!saved) {
      saved = {
        id: input.id,
        organizer: "a@example.com",
        revision: 1,
        expense: input.expense,
        responses: {},
        repayments: [],
        audit: [],
      };
      return route.abort("failed");
    }
    return route.fulfill({ json: saved });
  });
  await page.goto("/?legacy=1");
  await page
    .getByRole("link", { name: "New split", exact: true })
    .first()
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Interrupted dinner");
  await page.getByLabel("Name", { exact: true }).nth(1).fill("B");
  await page.getByLabel("Email", { exact: true }).nth(1).fill("b@example.com");
  await page.getByLabel("Total (KRW)").fill("60000");
  await page.getByRole("button", { name: "Review split", exact: true }).click();
  await page
    .getByRole("button", { name: "Publish split", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry interrupted save" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry interrupted save" }).click();
  await expect(
    page.getByText("Your share ₩30,000", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry interrupted save" }),
  ).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test("old pilot links preserve the split destination in the main workspace", async ({
  page,
}) => {
  await session(page);
  await page.route("**/api/pilot", (route) => route.fulfill({ json: [] }));
  await page.goto("/pilot?split=missing-synthetic-id");
  await expect(page).toHaveURL(/\/\?split=missing-synthetic-id$/);
  await expect(
    page.getByRole("heading", { name: "Split details", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "This split is unavailable for your email.",
    }),
  ).toBeVisible();
  await expect(page.getByText("Dinner splits", { exact: true })).toHaveCount(0);
});
