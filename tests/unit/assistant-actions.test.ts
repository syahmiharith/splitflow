import { describe, it, expect, vi } from "vitest";
import {
  createActivity,
  createGroup,
  changeGroup,
  changeActivity,
} from "@/lib/activity/model";
import type { RecordRow } from "@/lib/activity/client";
import { prepareBatch } from "@/lib/activity/operations";
import {
  actionsSchema,
  assistantTools,
  prepareActions,
} from "@/lib/assistant/tools";
import { assistantRequest, type AssistantStore } from "@/lib/assistant/service";
import { emptyThread, type AssistantThread } from "@/lib/assistant/model";
import {
  openAIProvider,
  runAssistant,
  type Provider,
} from "@/lib/assistant/provider";
import { balances } from "@/lib/pilot/model";
const email = "alex@example.test",
  other = "minji@example.test";
const people = [
  { name: "Alex", email },
  { name: "Minji", email: other },
];
const expense = {
  title: "Dinner",
  mode: "paid" as const,
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
function fixture() {
  return createActivity(email, {
    title: "Dinner activity",
    kind: "quick",
    people,
  });
}
function provider(actions?: unknown, text = "Which amount?"): Provider {
  return async () =>
    actions
      ? {
          output: [
            {
              type: "function_call",
              name: "prepare_actions",
              arguments: JSON.stringify({ actions }),
              call_id: "call",
            },
          ],
        }
      : {
          output: [
            { type: "message", content: [{ type: "output_text", text }] },
          ],
        };
}
function memory(initial: RecordRow[] = []) {
  let rows = structuredClone(initial);
  const threads = new Map<string, AssistantThread>(),
    results = new Map<string, AssistantThread>();
  let fail = false;
  const store: AssistantStore = {
    async load(id) {
      return structuredClone(threads.get(id) ?? null);
    },
    async rows() {
      return structuredClone(rows);
    },
    async result(id, key) {
      return structuredClone(results.get(`${id}:${key}`) ?? null);
    },
    async save(t, expected, key) {
      const prior = results.get(`${t.id}:${key}`);
      if (prior) return prior;
      if ((threads.get(t.id)?.revision ?? 0) !== expected) throw Error("stale");
      const next = structuredClone({ ...t, revision: expected + 1 });
      threads.set(t.id, next);
      results.set(`${t.id}:${key}`, next);
      return structuredClone(next);
    },
    async commit(t, expected, key) {
      if (fail) throw Error("network unavailable");
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
  return {
    store,
    setRows: (r: RecordRow[]) => {
      rows = r;
    },
    fail: () => {
      fail = true;
    },
  };
}
const req = (id: string, expected = 0, activityId: string | null = null) => ({
  id,
  key: crypto.randomUUID(),
  expected,
  activityId,
  action: "send" as const,
  message: "Create dinner",
});
describe("action-capable assistant", () => {
  it("prepares create + expense, reviews once, commits atomically and replays a lost result", async () => {
    const { store } = memory();
    const id = crypto.randomUUID();
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
    const draft = await assistantRequest(req(id), email, store, (t, r, e) =>
      runAssistant(t, r, e, provider(actions)),
    );
    expect(await store.rows()).toHaveLength(0);
    expect(draft.pending?.operations).toHaveLength(2);
    expect(draft.pending?.previews[1].lines.join()).toContain("₩30,000");
    const confirm = {
      ...req(id, draft.revision),
      action: "confirm" as const,
      proposalId: draft.pending!.id,
    };
    const saved = await assistantRequest(confirm, email, store);
    expect(saved.pending).toBeNull();
    expect((await store.rows())[0].document.revision).toBe(2);
    expect(await assistantRequest(confirm, email, store)).toEqual(saved);
  });
  it("persists a user message before provider failure and preserves it on retry", async () => {
    const { store } = memory();
    const id = crypto.randomUUID();
    const failed = await assistantRequest(req(id), email, store, async () => {
      expect((await store.load(id))?.status).toBe("processing");
      throw Error("offline");
    });
    expect(failed.status).toBe("unavailable");
    const recovered = await assistantRequest(
      { ...req(id, failed.revision), action: "retry" },
      email,
      store,
      (t, r, e) => runAssistant(t, r, e, provider()),
    );
    expect(recovered.messages.filter((m) => m.role === "user")).toHaveLength(1);
    expect(recovered.status).toBe("idle");
  });
  it("asks clarifications without mutation", async () => {
    const { store } = memory();
    const result = await assistantRequest(
      req(crypto.randomUUID()),
      email,
      store,
      (t, r, e) =>
        runAssistant(t, r, e, provider(undefined, "Which Alex do you mean?")),
    );
    expect(result.pending).toBeNull();
    expect(result.messages.at(-1)?.text).toContain("Which Alex");
    expect(await store.rows()).toHaveLength(0);
  });
  it("invalidates an old confirmation when a replacement fails", async () => {
    const a = fixture();
    const { store } = memory([{ kind: "activity", document: a }]);
    const id = crypto.randomUUID();
    const first = await assistantRequest(
      req(id, 0, a.id),
      email,
      store,
      (t, r, e) =>
        runAssistant(
          t,
          r,
          e,
          provider([
            {
              type: "change_activity",
              target: a.id,
              command: { type: "expense", expense },
            },
          ]),
        ),
    );
    const second = await assistantRequest(
      { ...req(id, first.revision, a.id), message: "Change drinks" },
      email,
      store,
    );
    expect(second.pending).toBeNull();
    expect(second.draft).not.toBeNull();
    await expect(
      assistantRequest(
        {
          ...req(id, second.revision, a.id),
          action: "confirm",
          proposalId: first.pending!.id,
        },
        email,
        store,
      ),
    ).rejects.toThrow("Review");
  });
  it("rejects stale financial reviews without saving", async () => {
    const a = fixture();
    const m = memory([{ kind: "activity", document: a }]);
    const id = crypto.randomUUID();
    const draft = await assistantRequest(
      req(id, 0, a.id),
      email,
      m.store,
      (t, r, e) =>
        runAssistant(
          t,
          r,
          e,
          provider([
            {
              type: "change_activity",
              target: a.id,
              command: { type: "expense", expense },
            },
          ]),
        ),
    );
    m.setRows([
      {
        kind: "activity",
        document: changeActivity(a, email, {
          type: "message",
          text: "Concurrent update",
        }),
      },
    ]);
    const result = await assistantRequest(
      {
        ...req(id, draft.revision, a.id),
        action: "confirm",
        proposalId: draft.pending!.id,
      },
      email,
      m.store,
    );
    expect(result.pending).toBeNull();
    expect(result.messages.at(-1)?.text).toContain("fresh review");
    expect((await m.store.rows())[0].document).toHaveProperty("expenses", []);
  });
  it("validates every batch member before writing any record", () => {
    const a = fixture();
    const rows: RecordRow[] = [{ kind: "activity", document: a }];
    expect(() =>
      prepareActions(
        {
          actions: [
            {
              type: "change_activity",
              target: a.id,
              command: { type: "expense", expense },
            },
            {
              type: "change_group",
              target: crypto.randomUUID(),
              command: { type: "rename", name: "bad" },
            },
          ],
        },
        rows,
        email,
      ),
    ).toThrow();
    expect(a.expenses).toHaveLength(0);
  });
  it("blocks unauthorized group management and fabricated record references", () => {
    const group = createGroup(email, { name: "House", people });
    expect(() =>
      prepareActions(
        {
          actions: [
            {
              type: "change_group",
              target: group.id,
              command: { type: "rename", name: "Hijacked" },
            },
          ],
        },
        [{ kind: "group", document: group }],
        other,
      ),
    ).toThrow("owner");
    expect(() =>
      prepareActions(
        {
          actions: [
            {
              type: "change_group",
              target: crypto.randomUUID(),
              command: { type: "join" },
            },
          ],
        },
        [],
        email,
      ),
    ).toThrow("unavailable");
  });
  it("requires joined members for grouped activity creation", () => {
    const group = createGroup(email, { name: "House", people });
    const actions = {
      actions: [
        {
          type: "create_activity",
          ref: "rent",
          input: {
            title: "Rent",
            kind: "recurring",
            people,
            groupId: group.id,
          },
        },
      ],
    };
    expect(() =>
      prepareActions(actions, [{ kind: "group", document: group }], email),
    ).toThrow("joined");
    const joined = changeGroup(group, other, { type: "join" });
    const proposal = prepareActions(
      actions,
      [{ kind: "group", document: joined }],
      email,
    );
    expect(proposal.dependencies).toEqual([
      { id: group.id, revision: joined.revision },
    ]);
  });
  it("supports exclusions, units and custom allocations using exact deterministic shares", () => {
    const a = fixture();
    const modified = {
      ...expense,
      items: [
        {
          name: "Food",
          amount: 48000,
          included: [email, other],
          custom: null,
          units: [
            { email, value: 1 },
            { email: other, value: 2 },
          ],
        },
        {
          name: "Drinks",
          amount: 12000,
          included: [email],
          custom: [{ email, value: 12000 }],
          units: null,
        },
      ],
    };
    const p = prepareActions(
      {
        actions: [
          {
            type: "change_activity",
            target: a.id,
            command: { type: "expense", expense: modified },
          },
        ],
      },
      [{ kind: "activity", document: a }],
      email,
    );
    expect(p.previews[0].lines.join()).toContain("₩28,000");
    expect(p.previews[0].lines.join()).toContain("₩32,000");
  });
  it("only the recipient confirms and overpayments remain credits", () => {
    const a = fixture();
    const publish = prepareActions(
      {
        actions: [
          {
            type: "change_activity",
            target: a.id,
            command: { type: "expense", expense },
          },
        ],
      },
      [{ kind: "activity", document: a }],
      email,
    );
    let rows = prepareBatch(
      [{ kind: "activity", document: a }],
      email,
      publish.operations,
    ).rows;
    let active = rows[0].document as ReturnType<typeof fixture>;
    const split = active.expenses[0];
    const report = prepareActions(
      {
        actions: [
          {
            type: "change_activity",
            target: a.id,
            command: {
              type: "expenseCommand",
              id: split.id,
              command: {
                type: "report",
                to: email,
                amount: 40000,
                reference: "bank",
              },
            },
          },
        ],
      },
      rows,
      other,
    );
    rows = prepareBatch(rows, other, report.operations).rows;
    active = rows[0].document as typeof active;
    expect(balances(active.expenses[0])[other]).toBe(30000);
    const receipt = {
      actions: [
        {
          type: "change_activity",
          target: a.id,
          command: {
            type: "expenseCommand",
            id: split.id,
            command: {
              type: "receipt",
              paymentId: active.expenses[0].repayments[0].id,
              status: "confirmed",
            },
          },
        },
      ],
    };
    expect(() => prepareActions(receipt, rows, other)).toThrow();
    const p = prepareActions(receipt, rows, email);
    active = prepareBatch(rows, email, p.operations).rows[0]
      .document as typeof active;
    expect(balances(active.expenses[0])[other]).toBe(-10000);
  });
  it("supports recurring terms, acceptance and pause without fabricated payments", () => {
    let a = createActivity(email, { title: "Rent", kind: "recurring", people });
    let rows: RecordRow[] = [{ kind: "activity", document: a }];
    const schedule = prepareActions(
      {
        actions: [
          {
            type: "change_activity",
            target: a.id,
            command: {
              type: "schedule",
              expense,
              start: "2026-11-08",
              dueDay: 1,
              variable: true,
            },
          },
        ],
      },
      rows,
      email,
    );
    rows = prepareBatch(rows, email, schedule.operations).rows;
    const accept = prepareActions(
      {
        actions: [
          {
            type: "change_activity",
            target: a.id,
            command: { type: "acceptTerms" },
          },
        ],
      },
      rows,
      other,
    );
    rows = prepareBatch(rows, other, accept.operations).rows;
    const pause = prepareActions(
      {
        actions: [
          {
            type: "change_activity",
            target: a.id,
            command: { type: "pauseSchedule", paused: true },
          },
        ],
      },
      rows,
      email,
    );
    a = prepareBatch(rows, email, pause.operations).rows[0]
      .document as typeof a;
    expect(a.schedule?.accepted).toContain(other);
    expect(a.schedule?.paused).toBe(true);
    expect(a.expenses).toHaveLength(0);
  });
  it("does not expose a commit tool and rejects unknown action shapes", () => {
    expect(assistantTools.map((t) => t.name)).toEqual([
      "read_workspace",
      "prepare_actions",
    ]);
    expect(() =>
      actionsSchema.parse({
        actions: [{ type: "sql", query: "delete everything" }],
      }),
    ).toThrow();
  });
  it("bounds malformed tool loops", async () => {
    let calls = 0;
    const p: Provider = async () => {
      calls++;
      return {
        output: [
          {
            type: "function_call",
            name: "execute_sql",
            arguments: "{}",
            call_id: "bad",
          },
        ],
      };
    };
    await expect(
      runAssistant(emptyThread(crypto.randomUUID(), null), [], email, p),
    ).rejects.toThrow("could not finish");
    expect(calls).toBe(5);
  });
});

it("keeps a reviewed proposal retryable if the database commit fails", async () => {
  const a = fixture();
  const m = memory([{ kind: "activity", document: a }]);
  const id = crypto.randomUUID();
  const review = await assistantRequest(
    req(id, 0, a.id),
    email,
    m.store,
    (t, r, e) =>
      runAssistant(
        t,
        r,
        e,
        provider([
          {
            type: "change_activity",
            target: a.id,
            command: { type: "expense", expense },
          },
        ]),
      ),
  );
  m.fail();
  await expect(
    assistantRequest(
      {
        ...req(id, review.revision, a.id),
        action: "confirm",
        proposalId: review.pending!.id,
      },
      email,
      m.store,
    ),
  ).rejects.toThrow("network");
  expect((await m.store.load(id))?.pending?.id).toBe(review.pending!.id);
});

it("sends strict tools through Responses without provider storage", async () => {
  vi.stubEnv("OPENAI_API_KEY", "test-only-not-a-credential");
  const fetcher = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: "What amount?" }],
          },
        ],
      }),
      { status: 200 },
    ),
  );
  vi.stubGlobal("fetch", fetcher);
  try {
    await openAIProvider(
      [{ role: "user", content: "Dinner" }],
      new AbortController().signal,
    );
    const body = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(body.store).toBe(false);
    expect(body.parallel_tool_calls).toBe(false);
    expect(body.tools.every((t: { strict: boolean }) => t.strict)).toBe(true);
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://api.openai.com/v1/responses",
    );
  } finally {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  }
});
