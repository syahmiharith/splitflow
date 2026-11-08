import { test, expect } from "@playwright/test";
import type { SavedGroup } from "../../lib/pilot/groups";
test("a lost group save replays its key after reload and retains its reviewed people", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
  await page.route("**/api/pilot/conversations", (route) =>
    route.fulfill({ json: [] }),
  );
  let saved: SavedGroup | undefined;
  const keys: string[] = [];
  await page.route("**/api/pilot/groups", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: saved ? [saved] : [] });
    const input = route.request().postDataJSON();
    keys.push(input.key);
    if (!saved) {
      saved = {
        id: input.id,
        revision: 1,
        name: input.name,
        people: input.people,
      };
      return route.abort("failed");
    }
    return route.fulfill({ json: saved });
  });
  await page.goto("/?legacy=1");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Saved groups", exact: true });
  await modal.getByRole("button", { name: "New group", exact: true }).click();
  await modal.getByLabel("Group name", { exact: true }).fill("Weekend crew");
  await modal.getByLabel("Group person 2 name", { exact: true }).fill("Minji");
  await modal
    .getByLabel("Group person 2 email", { exact: true })
    .fill("minji@example.test");
  await modal.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(
    modal.getByRole("button", { name: "Retry group save", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  await modal
    .getByRole("button", { name: "Retry group save", exact: true })
    .click();
  await expect(modal.getByText("Group saved.", { exact: true })).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await modal.getByRole("button", { name: "Use group", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Enter expense", exact: true })
      .getByLabel("Name", { exact: true })
      .nth(1),
  ).toHaveValue("Minji");
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
});

test("stale group edits require a fresh review and retain the organizer's text", async ({
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
  await page.route("**/api/pilot/conversations", (route) =>
    route.fulfill({ json: [] }),
  );
  let group: SavedGroup = {
    id: crypto.randomUUID(),
    revision: 1,
    name: "Dinner friends",
    people: [
      { name: "You", email: "a@example.com" },
      { name: "Minji", email: "minji@example.test" },
    ],
  };
  const expected: number[] = [];
  await page.route("**/api/pilot/groups", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: [group] });
    const input = route.request().postDataJSON();
    expected.push(input.expected);
    if (expected.length === 1) {
      group = { ...group, revision: 2, name: "Latest saved name" };
      return route.fulfill({
        status: 409,
        json: {
          error:
            "This group changed. Review the latest group before saving your retained edit.",
        },
      });
    }
    group = { ...group, ...input, revision: 3 };
    return route.fulfill({ json: group });
  });
  await page.goto("/?legacy=1");
  await page.getByRole("button", { name: "Groups", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Saved groups", exact: true });
  await modal
    .getByRole("button", { name: "Edit Dinner friends", exact: true })
    .click();
  await modal
    .getByLabel("Group name", { exact: true })
    .fill("My retained name");
  await modal.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(modal.getByRole("alert")).toContainText("group changed");
  await modal
    .getByRole("button", {
      name: "Review retained edit against latest",
      exact: true,
    })
    .click();
  await expect(modal.getByRole("status")).toContainText("Latest saved name");
  await expect(modal.getByLabel("Group name", { exact: true })).toHaveValue(
    "My retained name",
  );
  await modal.getByRole("button", { name: "Save group", exact: true }).click();
  await expect(modal.getByText("Group saved.", { exact: true })).toBeVisible();
  expect(expected).toEqual([1, 2]);
  await modal
    .getByRole("button", { name: "Close saved groups", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Groups", exact: true }),
  ).toBeFocused();
});
