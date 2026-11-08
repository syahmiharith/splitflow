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
  const create = page.getByRole("region", { name: "New activity" });
  await create.getByLabel("Activity name").fill("Court booking");
  await create.getByRole("button", { name: "Continue to people" }).click();
  await create.getByLabel("Activity person 1 name").fill("Alex");
  await create.getByLabel("Activity person 2 name").fill("Minji");
  await create.getByLabel("Activity person 2 email").fill("minji@example.test");
  await create.getByRole("button", { name: "Start activity" }).click();
  await page.getByRole("button", { name: "Add cost", exact: true }).click();
  const review = page.getByRole("region", { name: "Review expense" });
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
  const create = page.getByRole("region", { name: "New activity" });
  await create.getByLabel("Activity name").fill("Shared rent");
  await create.getByRole("button", { name: "Continue to people" }).click();
  await create.getByLabel("Activity person 1 name").fill("Alex");
  await create.getByLabel("Activity person 2 name").fill("Minji");
  await create.getByLabel("Activity person 2 email").fill("minji@example.test");
  await create.getByRole("button", { name: "Start activity" }).click();
  await page
    .getByRole("button", { name: "Set up schedule", exact: true })
    .click();
  const schedule = page.getByRole("region", { name: "Recurring schedule" });
  await schedule
    .getByLabel("Monthly amount (KRW)", { exact: true })
    .fill("900000");
  await schedule.getByRole("button", { name: "Continue to timing" }).click();
  await schedule
    .getByRole("button", { name: "Review recurring terms", exact: true })
    .click();
  await schedule
    .getByRole("button", { name: "Share recurring terms", exact: true })
    .click();
  await expect(schedule).not.toBeVisible();
  await expect(
    page.getByText("Waiting for Minji", { exact: true }),
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
  const dialog = page.getByRole("region", { name: "New activity" });
  await expect(dialog.getByLabel("Activity name")).toHaveValue(
    "Weekend together again",
  );
  await dialog.getByRole("button", { name: "Continue to people" }).click();
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
      .getByRole("region", { name: "Review expense" })
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

test("group picker opens a conversation and starts an activity with selected members", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  let groups = page.getByRole("region", { name: "Shared groups" });
  await groups.getByRole("button", { name: /Friends & housemates/ }).click();
  await groups.getByRole("button", { name: /Weekend together/ }).click();
  await expect(
    page.getByRole("heading", { name: "Dinner", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  groups = page.getByRole("region", { name: "Shared groups" });
  await groups
    .getByRole("button", { name: "Start activity in Friends & housemates" })
    .click();
  const create = page.getByRole("region", { name: "New activity" });
  await create.getByLabel("Activity name").fill("Household supplies");
  await create.getByRole("button", { name: "Continue to people" }).click();
  await create.getByRole("checkbox", { name: /Sam/ }).uncheck();
  await create
    .getByRole("button", { name: "Start activity", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Household supplies", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Activity summary")).toContainText("2 people");
  await page
    .getByRole("button", { name: "Add first cost", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Review expense" })
      .getByLabel("Total (KRW)", { exact: true }),
  ).toBeVisible();
});

test("recurring edit keeps terms in context and shows who still needs to accept", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Household rent", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  const terms = page.getByRole("region", { name: "Recurring terms" });
  await expect(
    terms.getByText("Waiting for Minji", { exact: true }),
  ).toBeVisible();
  await terms.getByRole("button", { name: "Edit recurring terms" }).click();
  const dialog = page.getByRole("region", { name: "Recurring schedule" });
  await expect(
    dialog.getByRole("radio", { name: /Current recurring cost/ }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Continue to timing" }).click();
  await dialog.getByLabel("Due day of month (1–28)").fill("15");
  await dialog
    .getByRole("button", { name: "Review recurring terms", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Review monthly terms" }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Share recurring terms", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(terms).toContainText("Due day 15");
  await expect(terms).toContainText("Terms v2");
  await terms.getByRole("button", { name: "Pause schedule" }).click();
  await expect(
    terms.getByText("Schedule paused", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Recurring terms" }),
  ).toContainText("Schedule paused");
});

test("cost editing stays inline with discussion and the persistent composer", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Weekend together", exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page
    .getByLabel("Message your activity")
    .fill("Keep the dinner and taxi together");
  await page.getByLabel("Message your activity").press("Enter");
  await expect(
    page.getByText("Keep the dinner and taxi together", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add cost", exact: true }).click();
  const editor = page.getByRole("region", { name: "Review expense" });
  await expect(editor).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Dinner", exact: true }),
  ).toBeAttached();
  await expect(page.getByLabel("Message your activity")).toBeVisible();
  await editor.getByLabel("Total (KRW)", { exact: true }).fill("15000");
  await page
    .getByLabel("Message your activity")
    .fill("The taxi receipt is ready");
  await page.getByLabel("Message your activity").press("Enter");
  await expect(editor.getByLabel("Total (KRW)", { exact: true })).toHaveValue(
    "15000",
  );
  await expect(
    page.getByText("The taxi receipt is ready", { exact: true }),
  ).toBeAttached();
  await page.getByRole("button", { name: "Close Review expense" }).click();
  await page.getByLabel("More activity actions").click();
  await page
    .getByRole("button", { name: "People & share", exact: true })
    .click();
  const share = page.getByRole("region", { name: "People & share" });
  await expect(
    share.getByRole("button", { name: "Copy invitation link" }),
  ).toHaveCount(1);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a conversation starts from the composer and keeps the opening message", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Message your activity").fill("Saturday tennis");
  await page.getByRole("button", { name: "Start conversation" }).click();
  const setup = page.getByRole("region", { name: "New activity" });
  await expect(setup.getByLabel("Activity name")).toHaveValue(
    "Saturday tennis",
  );
  await expect(setup.getByLabel("Activity person 2 email")).toHaveCount(0);
  await setup.getByRole("button", { name: "Continue to people" }).click();
  await setup.getByLabel("Activity person 2 name").fill("Minji");
  await setup.getByLabel("Activity person 2 email").fill("minji@example.test");
  await setup
    .getByRole("button", { name: "Start activity", exact: true })
    .click();
  await expect(setup).not.toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Conversation" })
      .getByText("Saturday tennis", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Message your activity")).toHaveValue("");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("shared group creation hands off to an inline invitation panel", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  const groups = page.getByRole("region", { name: "Shared groups" });
  await groups
    .getByRole("button", { name: "Create group", exact: true })
    .click();
  await groups.getByLabel("Group name", { exact: true }).fill("Tennis friends");
  await expect(groups.getByLabel("Group person 2 email")).toHaveCount(0);
  await groups.getByRole("button", { name: "Continue to invitations" }).click();
  await groups.getByLabel("Group person 2 name").fill("Minji");
  await groups.getByLabel("Group person 2 email").fill("minji@example.test");
  await groups.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(
    groups.getByRole("tab", { name: "People & invitations" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(groups.getByLabel("Group invitation link")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Message your activity")).toBeVisible();
});
