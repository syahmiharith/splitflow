import { test, expect } from "@playwright/test";
import {
  assistantRequest,
  type AssistantStore,
} from "../../lib/assistant/service";
import { prepareBatch } from "../../lib/activity/operations";
import { runAssistant, type Provider } from "../../lib/assistant/provider";
import type { AssistantThread } from "../../lib/assistant/model";
import type { RecordRow } from "../../lib/activity/client";

for (const method of ["confirm", "edit"] as const) {
test(`scripted assistant ${method} preserves the conversational draft`, async ({
  page,
}) => {
  const email = "alex@example.test",
    other = "minji@example.test";
  let rows: RecordRow[] = [];
  const threads = new Map<string, AssistantThread>(),
    operations = new Map<string, AssistantThread>();
  const store: AssistantStore = {
    async load(id) {
      return threads.get(id) ?? null;
    },
    async result(id, key) {
      return operations.get(id + key) ?? null;
    },
    async rows() {
      return rows;
    },
    async save(t, expected, key) {
      if ((threads.get(t.id)?.revision ?? 0) !== expected) throw Error("Stale");
      const next = structuredClone({ ...t, revision: expected + 1 });
      threads.set(t.id, next);
      operations.set(t.id + key, next);
      return next;
    },
    async commit(t, expected, key) {
      const prepared = prepareBatch(rows, email, t.pending!.operations);
      const next = await store.save(
        { ...t, pending: null, draft: null },
        expected,
        key,
      );
      rows = prepared.rows;
      return next;
    },
  };
  const people = [
    { name: "Alex", email },
    { name: "Minji", email: other },
  ];
  const expense = {
    title: "Dinner",
    mode: "paid",
    participants: people.map((p, i) => ({ ...p, paid: i ? 0 : 60000 })),
    items: [
      {
        name: "Dinner",
        amount: 60000,
        included: [email, other],
        custom: null,
        units: null,
      },
    ],
  };
  const provider: Provider = async (input) => {
    if (!JSON.stringify(input).includes("Dinner with Minji was"))
      return {
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: "Hi! What would you like to split?",
              },
            ],
          },
        ],
      };
    return {
      output: [
        {
          type: "function_call",
          name: "prepare_actions",
          call_id: "scripted-test",
          arguments: JSON.stringify({
            actions: [
              {
                type: "create_activity",
                ref: "dinner",
                input: {
                  title: "Dinner with Minji",
                  kind: "quick",
                  people,
                  groupId: null,
                },
              },
              {
                type: "change_activity",
                target: "dinner",
                command: { type: "expense", expense },
              },
            ],
          }),
        },
      ],
    };
  };
  await page.addInitScript(() =>
    localStorage.setItem(
      "splitflow-pilot-session",
      JSON.stringify({
        access_token: "synthetic-ui-only",
        refresh_token: "synthetic-ui-only",
        email: "alex@example.test",
        expires_at: Date.now() / 1000 + 3600,
      }),
    ),
  );
  await page.route("**/api/workspace", (route) =>
    route.fulfill({ json: rows }),
  );
  await page.route("**/api/workspace/assistant**", async (route) => {
    const r = route.request();
    if (r.method() === "GET" && new URL(r.url()).searchParams.has("list"))
      return route.fulfill({ json: [] });
    if (r.method() === "GET")
      return route.fulfill({
        json: await store.load(new URL(r.url()).searchParams.get("id")!),
      });
    try {
      const result = await assistantRequest(
        r.postDataJSON(),
        email,
        store,
        (t, r, e, onTool) => runAssistant(t, r, e, provider, [], onTool),
      );
      return route.fulfill({ json: result });
    } catch (e) {
      return route.fulfill({ status: 400, json: { error: String(e) } });
    }
  });
  await page.goto("/");
  await page.getByLabel("Message your activity").fill("Hi");
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(
    page.getByText("Hi! What would you like to split?", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Review proposed changes" }),
  ).toHaveCount(0);
  await page
    .getByLabel("Message your activity")
    .fill("Dinner with Minji was 60000 won. I paid.");
  await page.getByRole("button", { name: "Start conversation" }).click();
  const review = page.getByRole("region", { name: "Review proposed changes" });
  await expect(review).toContainText("₩30,000");
  await expect(page.getByLabel("Total (KRW)", { exact: true })).toHaveCount(0);
  expect(rows).toHaveLength(0);
  await expect(
    page.getByText("Preparing changes", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(review).toBeVisible();
  if (method === "edit") {
    await review.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("Activity name", { exact: true })).toHaveValue("Dinner with Minji");
    expect(rows).toHaveLength(0);
    await expect(review).toHaveCount(0);
    return;
  }
  if (test.info().project.name === "chromium") {
    for (const width of [320, 375, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await review.scrollIntoViewIfNeeded();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `../outputs/conversation-workspace/money-review-${width}.png` });
    }
  }
  await page.screenshot({
    path: `../outputs/conversation-workspace/scripted-review-${test.info().project.name}.png`,
  });
  await page.getByLabel("Message your activity").fill("confirm");
  await page.getByRole("button", { name: "Start conversation" }).click();
  await expect(
    page.getByRole("region", { name: "Saved result" }),
  ).toContainText("₩30,000");
  await expect(review).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Previous review" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Private assistant conversation" }),
  ).toContainText("Saved.");
  expect(rows).toHaveLength(1);
  const saved = page.getByRole("region", { name: "Saved result" });
  await expect(saved.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
  await expect(saved.locator("details")).not.toHaveAttribute("open");
  await saved.getByText("View details", { exact: true }).click();
  await expect(saved.locator("details")).toHaveAttribute("open", "");
  await saved.getByText("View details", { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `../outputs/conversation-workspace/scripted-saved-${test.info().project.name}.png`,
  });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Saved result" }),
  ).toContainText("₩30,000");
});

}

test("guest unavailable assistant retains private messages without posting to the group", async ({
  page,
}) => {
  await page.goto("/");
  if ((page.viewportSize()?.width ?? 0) < 1024)
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Weekend together", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.locator(".sf-activity-context")).not.toHaveAttribute("open", "");
  await expect(page.locator(".sf-message-own").filter({hasText:"Added Dinner"})).toHaveCount(0);
  await page
    .getByLabel("Message your activity")
    .fill("Privately review my dinner share");
  await page.getByRole("button", { name: "Send message" }).click();
  const privateChat = page.getByRole("region", {
    name: "Private assistant conversation",
  });
  await expect(privateChat).toContainText("Assistant unavailable");
  await expect(
    page.getByRole("region", {
      name: "Conversation",
      exact: true,
      includeHidden: true,
    }),
  ).not.toContainText("Privately review");
  await page.getByLabel("Message destination").click();
  await page
    .getByRole("option", { name: "Message group", exact: true })
    .click();
  await page.getByLabel("Message your activity").fill("Hello everyone");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(
    page.getByRole("region", {
      name: "Conversation",
      exact: true,
      includeHidden: true,
    }),
  ).toContainText("Hello everyone");
  await expect(privateChat).not.toContainText("Hello everyone");
});
