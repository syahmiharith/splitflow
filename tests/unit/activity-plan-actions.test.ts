import { describe, expect, it } from "vitest";
import { createActivity, changeActivity } from "@/lib/activity/model";
import { prepareOperation, prepareBatch } from "@/lib/activity/operations";
import { prepareActions, readableWorkspace } from "@/lib/assistant/tools";
import type { RecordRow } from "@/lib/activity/client";

const actor = "alex@example.test", other = "minji@example.test";
const make = () => createActivity(actor, {
  title: "Jeju", kind: "planned", people: [{ name: "Alex", email: actor }, { name: "Minji", email: other }],
});
const plan = { limit: 600000, categories: [{ name: "Hotel", amount: 300000, expenseIds: [] }, { name: "Food", amount: 180000, expenseIds: [] }] };
const command = { type: "plan" as const, plan, reason: "Keep the trip within our limit" };

describe("conversational spending plan actions", () => {
  it("permits the owner to review and record a plan without creating an obligation", () => {
    const activity = make();
    const rows: RecordRow[] = [{ kind: "activity", document: activity }];
    const proposal = prepareActions({ actions: [{ type: "change_activity", target: activity.id, command }] }, rows, actor);
    expect(activity.plan).toBeUndefined();
    expect(proposal.previews[0].plan?.current.limit).toBe(600000);
    expect(proposal.previews[0].lines).toContain("Planning does not create a debt, prove a cost or record a payment.");
    const saved = prepareBatch(rows, actor, proposal.operations).rows[0];
    expect(saved.kind).toBe("activity");
    if (saved.kind !== "activity") throw Error("Expected activity");
    expect(saved.document.plan).toEqual(plan);
    expect(saved.document.expenses).toEqual([]);
    expect(saved.document.messages.at(-1)?.text).toContain(command.reason);
    const context = readableWorkspace([saved]);
    expect(context[0].document).toHaveProperty("spendingPlanSummary.remainingAllowance", 600000);
  });
  it("rejects non-owner edits and stale reviewed plans", () => {
    const activity = make();
    expect(() => changeActivity(activity, other, command)).toThrow("owner");
    const saved = changeActivity(activity, actor, command);
    expect(() => prepareOperation([{ kind: "activity", document: saved }], actor, {
      id: saved.id, key: crypto.randomUUID(), expected: activity.revision, kind: "activity", command,
    })).toThrow("latest version");
  });
  it("reviews allowance adjustments with before/after amounts and leaves all rows untouched if the batch fails", () => {
    const activity = changeActivity(make(), actor, command);
    const rows: RecordRow[] = [{ kind: "activity", document: activity }];
    const adjusted = { ...plan, categories: [{ name: "Hotel", amount: 330000, expenseIds: [] }, { name: "Food", amount: 150000, expenseIds: [] }] };
    const proposal = prepareActions({ actions: [{ type: "change_activity", target: activity.id, command: { ...command, plan: adjusted, reason: "Hotel costs more; reduce food" } }] }, rows, actor);
    expect(proposal.previews[0].lines).toContain("Hotel: ₩300,000 → ₩330,000");
    expect(proposal.previews[0].lines).toContain("Food: ₩180,000 → ₩150,000");
    const invalid = { ...proposal.operations[0], expected: activity.revision + 1, command: { ...command, plan: { ...plan, limit: 1 } } };
    expect(() => prepareBatch(rows, actor, [...proposal.operations, invalid])).toThrow("exceed");
    expect(activity.plan).toEqual(plan);
  });
});
