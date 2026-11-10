import { describe, expect, it } from "vitest";
import { prepareActions } from "@/lib/assistant/tools";
import { assistantRequest, type AssistantStore } from "@/lib/assistant/service";
import type { AssistantThread } from "@/lib/assistant/model";
import { applyFinanceCommand, categoryAvailable, emptyFinance, financeSummary } from "@/lib/finance/model";
import { createActivity, createGroup, changeGroup } from "@/lib/activity/model";
import { prepareBatch } from "@/lib/activity/operations";
import type { RecordRow } from "@/lib/activity/client";
import { balances, claimState } from "@/lib/pilot/model";

const actor = "alex@example.test", other = "bo@example.test";
const people = [{ name: "Alex", email: actor }, { name: "Bo", email: other }];
const expense = { title: "Dinner", mode: "paid", participants: people.map((p,i) => ({ ...p, paid: i ? 0 : 60000 })), items: [{ name: "Dinner", amount: 60000, included: [actor, other], custom: null, units: null }] };
function fixture() {
  const activity = createActivity(actor, { title: "Dinner outing", kind: "quick", people });
  const friendship = changeGroup(createGroup(actor, { name: "Friends", people, friendship: true }), other, { type: "join" });
  const rows: RecordRow[] = [{ kind: "group", document: friendship }, { kind: "activity", document: activity }];
  const actions = [
    { type: "change_activity", target: activity.id, command: { type: "expense", ref: "meal", expense } },
    { type: "finance", command: { type: "account", account: { id: "bank", name: "Bank", kind: "bank", currency: "KRW", openingBalance: 100000 } } },
    { type: "finance", command: { type: "category", category: { id: "food", name: "Food", currency: "KRW" } } },
    // Identical aliases are safe across separate personal/shared namespaces.
    { type: "finance", command: { type: "transaction", transaction: { id: "meal", accountId: "bank", date: "2026-11-10", amount: -60000, kind: "expense", payee: "Dinner", sharedExpenseId: "meal", reimbursableAmount: 30000, splits: [{ categoryId: "food", amount: 30000 }] } } },
  ];
  return { activity, rows, actions };
}
describe("mixed shared expense and private ledger batch", () => {
  it("resolves a new expense reference once without counting recoverable spending twice", () => {
    const { rows, actions } = fixture();
    const proposal = prepareActions({ actions }, rows, actor, { revision: 0, state: emptyFinance() });
    const command = proposal.operations[0].command as { id: string; ref?: string };
    expect(command.ref).toBeUndefined();
    expect(command.id).not.toBe("meal");
    const state = proposal.finance!.commands.reduce(applyFinanceCommand, emptyFinance());
    expect(state.transactions[0].sharedExpenseId).toBe(command.id);
    expect(state.transactions[0].id).not.toBe(command.id);
    expect(categoryAvailable(state, state.categories[0].id)).toBe(-30000);
    expect(financeSummary(state)[0]).toMatchObject({ cash: 40000, receivable: 30000 });
    const result = prepareBatch(rows, actor, proposal.operations).results[0];
    if (result.kind !== "activity") throw Error("Expected activity");
    expect(claimState(result.document.expenses[0])).toBe("pending");
    expect(balances(result.document.expenses[0])[other]).toBe(0);
    expect(proposal.previews.at(-1)!.lines.join(" ")).toContain("not participant agreement");
  });
  it("supports the explicit link command after recording an unlinked private expense", () => {
    const { rows, actions } = fixture();
    const last = actions.pop()!.command as unknown as { transaction: Record<string, unknown> };
    delete last.transaction.sharedExpenseId; delete last.transaction.reimbursableAmount; last.transaction.splits = [];
    const proposal = prepareActions({ actions: [...actions, { type: "finance", command: { type: "transaction", transaction: last.transaction } }, { type: "finance", command: { type: "linkSharedExpense", id: "meal", sharedExpenseId: "meal", reimbursableAmount: 30000, splits: [{ categoryId: "food", amount: 30000 }] } }] }, rows, actor, { revision: 0, state: emptyFinance() });
    expect(proposal.finance!.commands.at(-1)).toMatchObject({ sharedExpenseId: (proposal.operations[0].command as { id: string }).id });
  });
  it("rejects forward references, invalid amounts and duplicate aliases without partial changes", () => {
    const { rows, actions } = fixture(), before = structuredClone(rows);
    expect(() => prepareActions({ actions: [...actions.slice(1), actions[0]] }, rows, actor, { revision: 0, state: emptyFinance() })).toThrow("Shared expense unavailable");
    expect(() => prepareActions({ actions: [actions[0], actions[0]] }, rows, actor, { revision: 0, state: emptyFinance() })).toThrow("unique reference");
    const invalid = structuredClone(actions);
    (invalid.at(-1)!.command as unknown as { transaction: { reimbursableAmount: number } }).transaction.reimbursableAmount = 40000;
    expect(() => prepareActions({ actions: invalid }, rows, actor, { revision: 0, state: emptyFinance() })).toThrow("exact recoverable portion");
    (invalid.at(-1)!.command as unknown as { transaction: { sharedExpenseId: string } }).transaction.sharedExpenseId = crypto.randomUUID();
    expect(() => prepareActions({ actions: invalid }, rows, actor, { revision: 0, state: emptyFinance() })).toThrow("Shared expense unavailable");
    expect(rows).toEqual(before);
  });
  it("preserves existing UUID links and rejects aliases colliding with an existing expense", () => {
    const { rows, actions } = fixture();
    const first = prepareActions({ actions: [actions[0]] }, rows, actor);
    const prepared = prepareBatch(rows, actor, first.operations).rows;
    const id = (first.operations[0].command as { id: string }).id;
    expect(() => prepareActions({ actions: [{ ...actions[0], command: { ...actions[0].command, ref: id } }] }, prepared, actor)).toThrow("existing record IDs");
    const remaining = structuredClone(actions.slice(1));
    (remaining.at(-1)!.command as unknown as { transaction: { sharedExpenseId: string } }).transaction.sharedExpenseId = id;
    const proposal = prepareActions({ actions: remaining }, prepared, actor, { revision: 0, state: emptyFinance() });
    const transaction = proposal.finance!.commands.at(-1)!;
    expect(transaction.type === "transaction" && transaction.transaction.sharedExpenseId).toBe(id);
  });
  it("confirms the stored generated IDs once and returns the original lost-response result", async () => {
    const { rows: initialRows, actions, activity } = fixture();
    let rows = initialRows, finance = { revision: 0, state: emptyFinance() }, commits = 0;
    const threads = new Map<string, AssistantThread>(), results = new Map<string, AssistantThread>();
    const store: AssistantStore = {
      async load(id) { return structuredClone(threads.get(id) ?? null); },
      async result(id,key) { return structuredClone(results.get(`${id}:${key}`) ?? null); },
      async rows() { return structuredClone(rows); }, async finance() { return structuredClone(finance); },
      async save(thread,expected,key) {
        if ((threads.get(thread.id)?.revision ?? 0) !== expected) throw Error("stale");
        const saved = { ...structuredClone(thread), revision: expected + 1 };
        threads.set(thread.id,saved); results.set(`${thread.id}:${key}`,saved); return structuredClone(saved);
      },
      async commit(thread,expected,key,_results,personal) {
        const prepared = prepareBatch(rows,actor,thread.pending!.operations);
        if (personal?.expected !== finance.revision) throw Error("stale finance");
        rows = prepared.rows; finance = { revision: finance.revision + 1, state: personal.state }; commits++;
        return store.save({ ...thread, pending: null, draft: null },expected,key);
      },
    };
    const request = { id: crypto.randomUUID(), key: crypto.randomUUID(), expected: 0, activityId: activity.id, action: "send" as const, message: "Record dinner and my own spending" };
    const draft = await assistantRequest(request,actor,store,async()=>({ text: "Review", proposal: prepareActions({actions},rows,actor,finance) }));
    const expenseId = (draft.pending!.operations[0].command as { id: string }).id;
    const confirm = { ...request, key: crypto.randomUUID(), expected: draft.revision, action: "confirm" as const, proposalId: draft.pending!.id };
    const saved = await assistantRequest(confirm,actor,store);
    expect(await assistantRequest(confirm,actor,store)).toEqual(saved);
    expect(commits).toBe(1);
    expect(finance.state.transactions[0].sharedExpenseId).toBe(expenseId);
    expect(rows.find(r=>r.kind==="activity")!.document.id).toBe(activity.id);
    const second = await assistantRequest({ ...request, expected: saved.revision, key: crypto.randomUUID() },actor,store,async()=>({ text: "Review", proposal: prepareActions({actions},rows,actor,finance) }));
    const unchangedFinance = structuredClone(finance);
    rows = rows.map(row => row.kind === "activity" ? { ...row, document: { ...row.document, revision: row.document.revision + 1 } } : row);
    const stale = await assistantRequest({ ...confirm, key: crypto.randomUUID(), expected: second.revision, proposalId: second.pending!.id },actor,store);
    expect(stale.pending).toBeNull();
    expect(stale.messages.at(-1)!.text).toContain("Nothing was confirmed");
    expect(finance).toEqual(unchangedFinance);
    expect(commits).toBe(1);
  });
});
