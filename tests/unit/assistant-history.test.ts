import { describe, expect, it } from "vitest";
import { compactThread, historyPage } from "@/lib/assistant/history";
import { emptyThread, type AssistantThread, type Proposal, type Turn } from "@/lib/assistant/model";
import { assistantRequest, type AssistantStore } from "@/lib/assistant/service";
const turns = (count: number): Turn[] => Array.from({ length: count }, (_, i) => ({ id: `turn-${i}`, role: i % 2 ? "assistant" : "user", text: `Message ${i}`, at: "2026-11-10T00:00:00Z" }));
const proposal: Proposal = { id: "proposal", operations: [], dependencies: [], previews: [] };
describe("conversation continuation", () => {
  it("retains exact history and stable identity while bounding the active segment", () => {
    const original = { ...emptyThread(crypto.randomUUID(), null), messages: turns(160) };
    const next = compactThread(original);
    expect(next.thread.id).toBe(original.id);
    expect(next.thread.messages).toHaveLength(40);
    expect(next.thread.historyCount).toBe(120);
    expect([...next.archived, ...next.thread.messages]).toEqual(original.messages);
    expect(next.thread.title).toBe("Message 0");
    expect(original.messages).toHaveLength(160);
  });
  it("keeps an active review intact and its saved card with the result", () => {
    const thread: AssistantThread = { ...emptyThread(crypto.randomUUID(), null), messages: turns(160), pending: proposal };
    thread.messages[110].parts = [{ type: "review", proposal, status: "pending" }];
    expect(compactThread(thread).archived).toEqual([]);
    thread.pending = null;
    thread.messages[110].parts = [{ type: "review", proposal, status: "saved" }];
    thread.messages[155].parts = [{ type: "result", proposalId: proposal.id, previews: [], records: [] }];
    expect(compactThread(thread).archived).toHaveLength(110);
    expect(compactThread(thread).thread.messages[0].parts?.[0].type).toBe("review");
  });
  it("pages backwards and searches archived turns without mutating the source", () => {
    const segments = [1, 2, 3].map(index => ({ index, messages: turns(10) }));
    expect(historyPage(segments)).toMatchObject({ segments: [{ index: 3 }], nextBefore: 3 });
    expect(historyPage(segments, { before: 3, query: "message 4", limit: 2 }).segments.map(s => s.messages.length)).toEqual([1, 1]);
    expect(historyPage(segments, { before: 2 }).nextBefore).toBeNull();
    expect(segments[0].messages).toHaveLength(10);
  });
  it("continues beyond the previous hard stop and replays a lost response", async () => {
    let thread = { ...emptyThread(crypto.randomUUID(), null), messages: turns(160) };
    const results = new Map<string, typeof thread>();
    const store: AssistantStore = {
      load: async () => thread, rows: async () => [], result: async (_id, key) => results.get(key) ?? null,
      save: async (value, expected, key) => {
        if (results.has(key)) return results.get(key)!;
        if (thread.revision !== expected) throw Error("stale");
        thread = { ...compactThread(value).thread, revision: expected + 1 };
        results.set(key, thread); return thread;
      },
      commit: async () => { throw Error("unexpected mutation"); },
    };
    const request = { id: thread.id, key: crypto.randomUUID(), expected: 0, activityId: null, action: "send" as const, message: "Continue" };
    let calls = 0;
    const run = async () => { calls++; return { text: "Continuing", proposal: null }; };
    const result = await assistantRequest(request, "owner@example.test", store, run);
    expect(result.messages.at(-1)?.text).toBe("Continuing");
    expect(await assistantRequest(request, "owner@example.test", store, run)).toEqual(result);
    expect(calls).toBe(1);
  });
});
