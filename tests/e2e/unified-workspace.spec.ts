import { test, expect } from "@playwright/test";
test("guest activity uses the same conversation for costs and recipient confirmation", async ({
  page,
}) => {
  await page.goto("/");
  if (test.info().project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(
      page
        .getByText("Guest sample workspace", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close Navigation" }).click();
  } else
    await expect(
      page
        .getByText("Guest sample workspace", { exact: true })
        .filter({ visible: true }),
    ).toBeVisible();
  await page
    .getByRole("button", { name: "Weekend together", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Dinner", exact: true }),
  ).toBeVisible();
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByLabel("Sample person")
    .filter({ visible: true })
    .selectOption("minji@example.test");
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Close Navigation" }).click();
  await page
    .getByRole("button", { name: "Report payment", exact: true })
    .click();
  await page.getByLabel("Reference (optional)").fill("Sample transfer");
  await page.getByRole("button", { name: "Report sent", exact: true }).click();
  await expect(
    page.getByText("Sample transfer", { exact: true }),
  ).toBeVisible();
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByLabel("Sample person")
    .filter({ visible: true })
    .selectOption("alex@example.test");
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Close Navigation" }).click();
  await page
    .getByRole("button", { name: "Confirm received", exact: true })
    .click();
  await expect(page.getByText(/₩20,000 · confirmed/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/₩20,000 · confirmed/)).toBeVisible();
});

test("quick activity publishes an expense and keeps it in the conversation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Split a cost", exact: true }).click();
  const create = page.getByRole("dialog", { name: "New activity" });
  await create.getByLabel("Activity name").fill("Court booking");
  await create
    .getByLabel("People — name, email (one per line)")
    .fill("Alex, alex@example.test\nMinji, minji@example.test");
  await create.getByRole("button", { name: "Start activity" }).click();
  await page.getByRole("button", { name: "Add cost", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Review expense" });
  await review.getByLabel("Total (KRW)", { exact: true }).fill("60001");
  await review
    .getByRole("button", { name: "Review split", exact: true })
    .click();
  await review
    .getByRole("button", { name: "Publish split", exact: true })
    .click();
  await expect(review).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Court booking", exact: true }),
  ).toHaveCount(2);
  await expect(page.getByLabel("Message your activity")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Court booking", exact: true }),
  ).toHaveCount(2);
});

test("recurring terms require acceptance before a period appears", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Set up recurring costs", exact: true })
    .click();
  const create = page.getByRole("dialog", { name: "New activity" });
  await create.getByLabel("Activity name").fill("Shared rent");
  await create
    .getByLabel("People — name, email (one per line)")
    .fill("Alex, alex@example.test\nMinji, minji@example.test");
  await create.getByRole("button", { name: "Start activity" }).click();
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  const schedule = page.getByRole("dialog", { name: "Recurring schedule" });
  await schedule.getByLabel("Total (KRW)", { exact: true }).fill("900000");
  await schedule
    .getByRole("button", { name: "Review split", exact: true })
    .click();
  await schedule
    .getByRole("button", { name: "Publish split", exact: true })
    .click();
  await expect(schedule).not.toBeVisible();
  await expect(
    page.getByText("1/2 accepted · Active once accepted", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Activity expenses").locator("article"),
  ).toHaveCount(0);
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByLabel("Sample person")
    .filter({ visible: true })
    .selectOption("minji@example.test");
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Close Navigation" }).click();
  await page
    .getByRole("button", { name: "Accept recurring terms", exact: true })
    .click();
  await expect(
    page.getByLabel("Activity expenses").locator("article"),
  ).toHaveCount(1);
  await page.reload();
  await expect(
    page.getByLabel("Activity expenses").locator("article"),
  ).toHaveCount(1);
});

test("repeating an activity reuses people and rules without copying payment history", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Weekend together", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Repeat activity", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "New activity" });
  await expect(dialog.getByLabel("Activity name")).toHaveValue(
    "Weekend together again",
  );
  await dialog.getByRole("button", { name: "Start activity" }).click();
  await expect(
    page.getByRole("heading", { name: "Weekend together again", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Activity expenses").locator("article"),
  ).toHaveCount(0);
  await page.getByLabel("Reuse expense rules").selectOption("0");
  await expect(
    page
      .getByRole("dialog", { name: "Review expense" })
      .getByLabel("Total (KRW)", { exact: true }),
  ).toHaveValue("");
});

test("a signed-in empty account does not receive sample activities", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "splitflow-pilot-session",
      JSON.stringify({
        access_token: "synthetic-ui-only",
        refresh_token: "synthetic-ui-only",
        email: "real@example.test",
        expires_at: Date.now() / 1000 + 3600,
      }),
    ),
  );
  await page.route("**/api/workspace", (route) => route.fulfill({ json: [] }));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What are we sharing costs for?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Weekend together", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Guest sample workspace", { exact: true }),
  ).toHaveCount(0);
});

test("an interrupted activity submission replays its original key after reload", async ({
  page,
}) => {
  const id = crypto.randomUUID();
  let revision = 1;
  const messages: { id: string; actor: string; text: string; at: string }[] =
    [];
  const keys: string[] = [];
  const document = () => ({
    id,
    revision,
    title: "Recovery activity",
    kind: "quick",
    owner: "owner@example.test",
    people: [
      { name: "Owner", email: "owner@example.test" },
      { name: "Guest", email: "guest@example.test" },
    ],
    expenses: [],
    messages,
    archivedBy: [],
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "splitflow-pilot-session",
      JSON.stringify({
        access_token: "synthetic-ui-only",
        refresh_token: "synthetic-ui-only",
        email: "owner@example.test",
        expires_at: Date.now() / 1000 + 3600,
      }),
    ),
  );
  await page.route("**/api/workspace", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({
        json: [{ kind: "activity", document: document() }],
      });
    const input = route.request().postDataJSON();
    keys.push(input.key);
    if (keys.length === 1) {
      revision++;
      messages.push({
        id: crypto.randomUUID(),
        actor: "owner@example.test",
        text: input.command.text,
        at: new Date().toISOString(),
      });
      return route.abort("failed");
    }
    return route.fulfill({ json: document() });
  });
  await page.goto(`/?activity=${id}`);
  await page
    .getByLabel("Message your activity")
    .fill("Remember the shared tickets");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("button", { name: "Retry original submission" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry original submission" }).click();
  await expect(
    page.getByRole("button", { name: "Retry original submission" }),
  ).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await expect(
    page.getByText("Remember the shared tickets", { exact: true }),
  ).toHaveCount(1);
});
