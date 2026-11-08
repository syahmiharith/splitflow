import { describe, it, expect, vi, afterEach } from "vitest";
import {
  createActivity,
  changeActivity,
  duePeriods,
  createGroup,
  changeGroup,
} from "@/lib/activity/model";
import type { Expense } from "@/lib/pilot/model";
afterEach(() => vi.useRealTimers());
const a = "a@example.test",
  b = "b@example.test",
  c = "c@example.test";
const people = [
  { email: a, name: "Alex" },
  { email: b, name: "Bo" },
];
const expense: Expense = {
  title: "Rent",
  mode: "paid",
  participants: people.map((p, i) => ({ ...p, paid: i === 0 ? 900000 : 0 })),
  items: [{ name: "Rent", amount: 900000, included: [a, b] }],
};
const make = () =>
  createActivity(a, { title: "Home", kind: "recurring", people });
describe("shared activities", () => {
  it("lets participants add separate expenses but reserves edits for their author", () => {
    const initial = make();
    const added = changeActivity(initial, b, {
      type: "expense",
      id: crypto.randomUUID(),
      expense,
    });
    expect(added.expenses[0].organizer).toBe(b);
    expect(() =>
      changeActivity(added, a, {
        type: "expenseCommand",
        id: added.expenses[0].id,
        expected: 1,
        command: { type: "revise", expense, reason: "Edit" },
      }),
    ).toThrow();
    expect(() =>
      changeActivity(initial, c, { type: "message", text: "Hello" }),
    ).toThrow();
  });
  it("requires accepted recurring terms and creates unique monthly periods", () => {
    let v = changeActivity(make(), a, {
      type: "schedule",
      expectedVersion: 0,
      expense,
      start: "2026-01-31",
      dueDay: 5,
      variable: false,
    });
    expect(duePeriods(v, "2026-03-31")).toEqual([]);
    v = changeActivity(v, b, { type: "acceptTerms", version: 1 });
    expect(duePeriods(v, "2026-03-31").map((p) => p.period)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
    ]);
    v = changeActivity(v, a, { type: "pauseSchedule", paused: true });
    expect(duePeriods(v, "2026-03-31")).toEqual([]);
  });
  it("never publishes a variable bill without its amount or carries acceptance into changed terms", () => {
    let v = changeActivity(make(), a, {
      type: "schedule",
      expectedVersion: 0,
      expense,
      start: "2026-01-01",
      dueDay: 5,
      variable: true,
    });
    v = changeActivity(v, b, { type: "acceptTerms", version: 1 });
    expect(duePeriods(v, "2026-02-01")).toEqual([]);
    v = changeActivity(v, a, {
      type: "schedule",
      expectedVersion: 1,
      expense,
      start: "2026-02-01",
      dueDay: 5,
      variable: false,
    });
    expect(v.schedule?.accepted).toEqual([a]);
    expect(() =>
      changeActivity(v, b, { type: "acceptTerms", version: 1 }),
    ).toThrow();
  });
  it("supports explicit group acceptance and protects group management", () => {
    const g = createGroup(a, { name: "Home", people });
    expect(g.joined).toEqual([a]);
    expect(changeGroup(g, b, { type: "join" }).joined).toEqual([a, b]);
    expect(() =>
      changeGroup(g, b, { type: "rename", name: "Other" }),
    ).toThrow();
  });
});

it("rejects an owner editing an outdated version of recurring terms", () => {
  const current = changeActivity(make(), a, {
    type: "schedule",
    expectedVersion: 0,
    expense,
    start: "2026-01-01",
    dueDay: 5,
    variable: false,
  });
  expect(() =>
    changeActivity(current, a, {
      type: "schedule",
      expectedVersion: 0,
      expense,
      start: "2026-02-01",
      dueDay: 5,
      variable: false,
    }),
  ).toThrow(/changed/);
});
it("resuming does not backfill paused periods", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-02T00:00:00Z"));
  let current = changeActivity(make(), a, {
    type: "schedule",
    expectedVersion: 0,
    expense,
    start: "2026-01-01",
    dueDay: 5,
    variable: false,
  });
  current = changeActivity(current, b, { type: "acceptTerms", version: 1 });
  current = changeActivity(current, a, { type: "pauseSchedule", paused: true });
  current = changeActivity(current, a, {
    type: "pauseSchedule",
    paused: false,
  });
  expect(duePeriods(current, "2026-03-31")).toEqual([]);
});

it("repeats activity rules without copying obligations or receipts", () => {
  const original = changeActivity(make(), a, {
    type: "expense",
    id: crypto.randomUUID(),
    expense,
  });
  const repeated = createActivity(a, {
    title: "Next activity",
    kind: "quick",
    people,
    templates: original.expenses.map((s) => s.expense),
  });
  expect(repeated.templates?.[0]).toEqual(expense);
  expect(repeated.expenses).toEqual([]);
  expect(repeated.messages).toEqual([]);
  expect(repeated.schedule).toBeUndefined();
});
it("expires group invitations and preserves existing activity membership when someone leaves the group", () => {
  const group = createGroup(a, { name: "Friends", people });
  group.invitations[b] = new Date(Date.now() - 1000).toISOString();
  expect(() => changeGroup(group, b, { type: "join" })).toThrow(/expired/);
  const active = make();
  const removed = changeGroup(group, a, { type: "remove", email: b });
  expect(removed.people.some((p) => p.email === b)).toBe(false);
  expect(
    changeActivity(active, b, {
      type: "message",
      text: "My existing activity remains available",
    }).messages,
  ).toHaveLength(1);
});
