import { test, expect, type Page } from "@playwright/test";
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
  throw Error("Local-only fixture");
async function signIn(page: Page, email: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Sign in" });
  await modal.getByLabel("Email", { exact: true }).fill(email);
  await modal.getByRole("button", { name: "Send email code" }).click();
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
  await modal.getByLabel("Email code").fill(code);
  await modal.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(modal).not.toBeVisible();
  return JSON.parse(
    (await page.evaluate(() =>
      localStorage.getItem("splitflow-pilot-session"),
    ))!,
  );
}
test("shared group acceptance, private activity, member cost and independent reload", async ({
  page,
  browser,
}) => {
  const run = `${Date.now()}-${test.info().project.name}`,
    a = `activity-a-${run}@example.test`,
    b = `activity-b-${run}@example.test`,
    c = `activity-c-${run}@example.test`;
  const owner = await signIn(page, a),
    context = await browser.newContext(),
    member = await context.newPage(),
    otherContext = await browser.newContext(),
    stranger = await otherContext.newPage();
  const second = await signIn(member, b),
    third = await signIn(stranger, c);
  const send = async (p: Page, token: string, data: unknown) =>
    p.request.post("/api/workspace", {
      headers: { Authorization: `Bearer ${token}` },
      data,
    });
  const people = [
      { email: a, name: "Owner" },
      { email: b, name: "Member" },
    ],
    groupId = crypto.randomUUID();
  let response = await send(page, owner.access_token, {
    kind: "group",
    id: groupId,
    key: crypto.randomUUID(),
    expected: 0,
    input: { name: "Shared friends", people },
  });
  expect(response.status()).toBe(200);
  response = await send(member, second.access_token, {
    kind: "group",
    id: groupId,
    key: crypto.randomUUID(),
    expected: 1,
    command: { type: "join" },
  });
  expect(response.status()).toBe(200);
  const id = crypto.randomUUID();
  response = await send(page, owner.access_token, {
    kind: "activity",
    id,
    key: crypto.randomUUID(),
    expected: 0,
    input: { title: "Shared project", kind: "quick", people, groupId },
  });
  expect(response.status()).toBe(200);
  const expenseId = crypto.randomUUID(),
    op = {
      kind: "activity",
      id,
      key: crypto.randomUUID(),
      expected: 1,
      command: {
        type: "expense",
        id: expenseId,
        expense: {
          title: "Materials",
          mode: "paid",
          participants: people.map((p, i) => ({
            ...p,
            paid: i === 1 ? 60001 : 0,
          })),
          items: [
            {
              name: "Materials",
              amount: 60001,
              included: [a, b],
              units: { [a]: 1, [b]: 2 },
            },
          ],
        },
      },
    };
  response = await send(member, second.access_token, op);
  expect(response.status()).toBe(200);
  const saved = await response.json();
  expect(saved.expenses).toHaveLength(1);
  expect(await (await send(member, second.access_token, op)).json()).toEqual(
    saved,
  );
  const unrelated = await stranger.request.get("/api/workspace", {
    headers: { Authorization: `Bearer ${third.access_token}` },
  });
  expect(await unrelated.json()).toEqual([]);
  expect(
    (
      await send(stranger, third.access_token, {
        kind: "activity",
        id,
        key: crypto.randomUUID(),
        expected: 2,
        command: { type: "message", text: "Not allowed" },
      })
    ).status(),
  ).toBe(403);
  await page.goto(`/?activity=${id}`);
  await expect(
    page.getByRole("heading", { name: "Materials", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Materials", exact: true }),
  ).toBeVisible();
  await member.goto(`/?activity=${id}`);
  await expect(
    member.getByRole("heading", { name: "Materials", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add cost", exact: true }).click();
  const editor = page.getByRole("region", { name: "Review expense" });
  await editor
    .getByLabel("Title", { exact: true })
    .fill("Private unfinished cost");
  await expect(
    editor.getByText("Private draft saved", { exact: true }),
  ).toBeVisible();
  const draftPath = `/api/workspace/drafts?activity=${id}&slot=new`;
  expect(
    (
      await (
        await page.request.get(draftPath, {
          headers: { Authorization: `Bearer ${owner.access_token}` },
        })
      ).json()
    ).expense.title,
  ).toBe("Private unfinished cost");
  expect(
    await (
      await member.request.get(draftPath, {
        headers: { Authorization: `Bearer ${second.access_token}` },
      })
    ).json(),
  ).toBeNull();
  await editor.getByRole("button", { name: "Close Review expense" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Add cost", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: "Review expense" })
      .getByLabel("Title", { exact: true }),
  ).toHaveValue("Private unfinished cost");
  await context.close();
  await otherContext.close();
});
