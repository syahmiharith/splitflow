import { expect, test } from "@playwright/test";
import type { Conversation } from "../../lib/pilot/conversation";
import type { Split, Expense } from "../../lib/pilot/model";
const expense: Expense = {
  title: "Saturday dinner",
  mode: "paid",
  participants: [
    { name: "You", email: "a@example.com", paid: 60000 },
    { name: "Minji", email: "b@example.com", paid: 0 },
    { name: "Alex", email: "c@example.com", paid: 0 },
  ],
  items: [
    {
      name: "Dinner",
      amount: 60000,
      included: ["a@example.com", "b@example.com", "c@example.com"],
    },
  ],
};
test("conversation clarifies, keeps one draft, reviews, publishes and restores", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "splitflow-pilot-session",
      JSON.stringify({
        access_token: "synthetic",
        refresh_token: "synthetic",
        expires_at: Date.now() / 1000 + 3600,
        email: "a@example.com",
      }),
    ),
  );
  let chats: Conversation[] = [];
  let splits: Split[] = [];
  let submissions = 0;
  await page.route("**/api/pilot/measurements", (route) =>
    route.fulfill({ json: { saved: true } }),
  );
  await page.route("**/api/pilot/conversations", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: chats });
    const input = route.request().postDataJSON();
    submissions++;
    const previous = chats.find((c) => c.id === input.id);
    const chat: Conversation = {
      id: input.id,
      revision: (previous?.revision ?? 0) + 1,
      title: input.expected === 0 ? "Dinner for three" : "Saturday dinner",
      messages: [
        ...(previous?.messages ?? []),
        { id: crypto.randomUUID(), role: "user", content: input.message },
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            input.expected === 0
              ? "Who joined, and what are their emails?"
              : "The draft is ready. Review the shares before publishing.",
        },
      ],
      draft: input.expected === 0 ? null : expense,
    };
    chats = [chat];
    return route.fulfill({ json: chat });
  });
  await page.route("**/api/pilot", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: splits });
    const input = route.request().postDataJSON();
    splits = [
      {
        id: input.id,
        revision: 1,
        organizer: "a@example.com",
        expense: input.expense,
        responses: {},
        repayments: [],
        audit: [],
      },
    ];
    return route.fulfill({ json: splits[0] });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "What are we splitting?" }),
  ).toBeVisible();
  await page
    .getByLabel("Message SplitFlow")
    .fill("Dinner for three was 60000. I paid.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("log")).toContainText("Who joined");
  expect(splits).toHaveLength(0);
  await page
    .getByLabel("Message SplitFlow")
    .fill("Minji b@example.com and Alex c@example.com joined me.");
  await page.getByLabel("Message SplitFlow").press("Enter");
  await expect(
    page.getByRole("region", { name: "Current split preview" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Current split preview" }),
  ).toContainText("₩20,000");
  await page.reload();
  await expect(page.getByRole("log")).toContainText("Who joined");
  await expect(
    page.getByRole("region", { name: "Current split preview" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Review split", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Review before publishing" }),
  ).toBeFocused();
  await expect(page.getByLabel("Reviewed shares")).toContainText("₩20,000");
  expect(splits).toHaveLength(0);
  await page
    .getByRole("button", { name: "Publish split", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByText("Published split", { exact: true }),
  ).toBeVisible();
  expect(splits).toHaveLength(1);
  expect(submissions).toBe(2);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Open split details" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
test("lost conversation response retries the same operation after reload", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "splitflow-pilot-session",
      JSON.stringify({
        access_token: "synthetic",
        refresh_token: "synthetic",
        expires_at: Date.now() / 1000 + 3600,
        email: "a@example.com",
      }),
    ),
  );
  await page.route("**/api/pilot", (route) => route.fulfill({ json: [] }));
  let saved: Conversation | undefined;
  const keys: string[] = [];
  await page.route("**/api/pilot/conversations", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: saved ? [saved] : [] });
    const input = route.request().postDataJSON();
    keys.push(input.key);
    if (!saved) {
      saved = {
        id: input.id,
        revision: 1,
        title: "Lost response",
        draft: null,
        messages: [
          { id: crypto.randomUUID(), role: "user", content: input.message },
        ],
      };
      return route.abort("failed");
    }
    return route.fulfill({ json: saved });
  });
  await page.goto("/");
  await page.getByLabel("Message SplitFlow").fill("Keep this dinner message");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("button", { name: "Retry saved submission" }),
  ).toBeVisible();
  // The draft route is not acknowledged; opening the saved server conversation must still offer its interrupted submission.
  await page.goto(`/?conversation=${saved!.id}`);
  await page.getByRole("button", { name: "Retry saved submission" }).click();
  await expect(page.getByRole("log")).toContainText("Keep this dinner message");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});
