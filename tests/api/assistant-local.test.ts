import { describe, it, expect, beforeAll } from "vitest";
import nextEnv from "@next/env";
import { serverStore } from "@/lib/assistant/server-store";
import { assistantRequest } from "@/lib/assistant/service";
import { runAssistant, type Provider } from "@/lib/assistant/provider";
import { database } from "@/lib/pilot/server";
import { prepareActions } from "@/lib/assistant/tools";
import { emptyThread } from "@/lib/assistant/model";
import { prepareBatch } from "@/lib/activity/operations";
nextEnv.loadEnvConfig(process.cwd());
const enabled = process.env.PILOT_LIVE_LOCAL === "1";
if (enabled && process.env.SUPABASE_URL !== "http://127.0.0.1:55421")
  throw Error("Local-only test");
describe.skipIf(!enabled)("local Postgres assistant transaction", () => {
  let owner: { id: string; email: string },
    other: { id: string; email: string },
    outsider: { id: string; email: string };
  async function commitActions(user: { id: string; email: string }, actions: unknown[]) {
    const store = serverStore(user);
    const proposal = prepareActions({ actions }, await store.rows(), user.email);
    const thread = emptyThread(crypto.randomUUID(), null);
    thread.pending = proposal;
    const saved = await store.save(thread, 0, `setup:${thread.id}`);
    return assistantRequest({ id: thread.id, key: crypto.randomUUID(), expected: saved.revision, activityId: null, action: "confirm", proposalId: proposal.id }, user.email, store);
  }
  beforeAll(async () => {
    const create = async (name: string) => {
      const email = `assistant-${name}-${crypto.randomUUID()}@example.test`;
      const key =
        process.env.SUPABASE_SECRET_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, email_confirm: true }),
      });
      expect(r.ok).toBe(true);
      const u = await r.json();
      return { id: u.id, email };
    };
    owner = await create("owner");
    other = await create("other");
    outsider = await create("outsider");
    await commitActions(owner, [{ type: "add_friend", person: { name: "Other", email: other.email } }]);
    await commitActions(other, [{ type: "add_friend", person: { name: "Owner", email: owner.email } }]);
  });
  it("does not create mutual consent by adding a friend and claiming costs in one actor's batch", async () => {
    const store = serverStore(owner);
    const actions = [
      { type: "add_friend", person: { name: "Outsider", email: outsider.email } },
      { type: "create_activity", ref: "unauthorized", input: { title: "Unilateral claim", kind: "quick", groupId: null, people: [{ name: "Owner", email: owner.email }, { name: "Outsider", email: outsider.email }] } },
    ];
    const initialRows = await store.rows();
    expect(() => prepareActions({ actions }, initialRows, owner.email)).toThrow("Both people must add each other");
    expect((await store.rows()).some(row => row.document.people.some(p => p.email === outsider.email))).toBe(false);
    await commitActions(owner, [actions[0]]);
    const pendingRows = await store.rows();
    expect(() => prepareActions({ actions: [actions[1]] }, pendingRows, owner.email)).toThrow("Both people must add each other");
    const pending = (await store.rows()).find(row => row.kind === "group" && row.document.people.some(p => p.email === outsider.email))!;
    expect(pending.document).toHaveProperty("joined", [owner.email]);
    await expect(database("rpc/commit_activity", { method: "POST", body: JSON.stringify({ p_actor: owner.id, p_key: crypto.randomUUID(), p_id: pending.document.id, p_kind: "group", p_expected: pending.document.revision, p_document: { ...pending.document, revision: pending.document.revision + 1, joined: [owner.email, outsider.email] } }) })).rejects.toThrow();
    await commitActions(outsider, [{ type: "add_friend", person: { name: "Owner", email: owner.email } }]);
    await expect(commitActions(owner, [actions[1]])).resolves.toBeDefined();
  });
  it("saves turns privately, commits a reviewed multi-record batch, and replays its exact result", async () => {
    const people = [
      { name: "Owner", email: owner.email },
      { name: "Other", email: other.email },
    ];
    const expense = {
      title: "Dinner",
      mode: "paid",
      participants: people.map((p, i) => ({ ...p, paid: i ? 0 : 60000 })),
      items: [
        {
          name: "Dinner",
          amount: 60000,
          included: people.map((p) => p.email),
          custom: null,
          units: null,
        },
      ],
    };
    const actions = [
      {
        type: "create_activity",
        ref: "dinner",
        input: { title: "Dinner", kind: "quick", people, groupId: null },
      },
      {
        type: "change_activity",
        target: "dinner",
        command: { type: "expense", expense },
      },
    ];
    const provider: Provider = async () => ({
      output: [
        {
          type: "function_call",
          name: "prepare_actions",
          arguments: JSON.stringify({ actions }),
          call_id: "test",
        },
      ],
    });
    const store = serverStore(owner);
    const id = crypto.randomUUID();
    const review = await assistantRequest(
      {
        id,
        key: crypto.randomUUID(),
        expected: 0,
        activityId: null,
        action: "send",
        message: "Dinner 60000",
      },
      owner.email,
      store,
      (t, r, e) => runAssistant(t, r, e, provider),
    );
    expect(review.pending?.operations).toHaveLength(2);
    expect(await serverStore(other).load(id)).toBeNull();
    const request = {
      id,
      key: crypto.randomUUID(),
      expected: review.revision,
      activityId: null,
      action: "confirm" as const,
      proposalId: review.pending!.id,
    };
    const result = await assistantRequest(request, owner.email, store);
    expect(result.pending).toBeNull();
    expect(await assistantRequest(request, owner.email, store)).toEqual(result);
    const saved = (await store.rows()).find(
      (r) => r.document.id === result.activityId,
    )!;
    expect(saved.document.revision).toBe(2);
    expect(saved.document).toHaveProperty("expenses.0.expense.title", "Dinner");
    const histories = await database(
      `activity_revisions?record_id=eq.${result.activityId}&select=revision`,
    );
    expect(histories).toHaveLength(2);
  });
  it("rolls back an earlier write if a later record fails in the database", async () => {
    const store = serverStore(owner);
    const proposal = prepareActions(
      {
        actions: [
          {
            type: "create_group",
            ref: "one",
            input: {
              name: "One",
              people: [
                { name: "Owner", email: owner.email },
                { name: "Other", email: other.email },
              ],
            },
          },
          {
            type: "create_group",
            ref: "two",
            input: {
              name: "Two",
              people: [
                { name: "Owner", email: owner.email },
                { name: "Other", email: other.email },
              ],
            },
          },
        ],
      },
      await store.rows(),
      owner.email,
    );
    const t = emptyThread(crypto.randomUUID(), null);
    t.pending = proposal;
    const saved = await store.save(t, 0, "rollback-start:" + t.id);
    const results = prepareBatch(
      await store.rows(),
      owner.email,
      proposal.operations,
    ).results;
    results[1].document.revision = 99;
    await expect(
      store.commit(saved, saved.revision, "rollback-done:" + t.id, results),
    ).rejects.toThrow();
    expect(
      (await store.rows()).some(
        (r) => r.document.id === proposal.operations[0].id,
      ),
    ).toBe(false);
    expect((await store.load(t.id))?.pending?.id).toBe(proposal.id);
  });
});
