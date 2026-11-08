import { test, expect } from "@playwright/test";

test("custom menus support keyboard selection, dismissal and mobile focus return", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Sign in", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Email", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Send email code" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Please fill in this field.",
  );
  await expect(dialog.getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeFocused();
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  const person = page
    .getByRole("button", { name: "Sample person" })
    .filter({ visible: true });
  await person.locator(".sf-avatar").click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(
    page.getByRole("option", { name: "Alex", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("m");
  await expect(
    page.getByRole("option", { name: "Minji", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(person).toContainText("Minji");
  await expect(person).toBeFocused();
  await person.getByText("Guest sample workspace").click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toBeHidden();
  await expect(person).toContainText("Minji");
});

test("recurring date picker navigates by keyboard without moving actions out of conversation", async ({
  page,
}) => {
  await page.goto("/");
  if (test.info().project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Household rent", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("button", { name: "Edit recurring terms", exact: true })
    .click();
  const panel = page.getByRole("region", { name: "Recurring schedule" });
  await panel.getByRole("button", { name: "Continue to timing" }).click();
  const trigger = panel.getByRole("button", {
    name: "First period starts",
    exact: true,
  });
  const before = await trigger.innerText();
  await trigger.click();
  const calendar = page.getByRole("dialog", {
    name: "First period starts calendar",
  });
  await expect(calendar).toBeVisible();
  await expect(
    calendar.getByRole("button", { name: before, exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    calendar.getByRole("button", { name: before, exact: true }),
  ).not.toBeFocused();
  await page.keyboard.press("Enter");
  await expect(calendar).toBeHidden();
  await expect(trigger).not.toHaveText(before);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("button", { name: "Next month", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(panel).toBeVisible();
  await expect(page.getByLabel("Message your activity")).toBeVisible();
  await expect(page.locator('input[type="date"], dialog')).toHaveCount(0);
});
