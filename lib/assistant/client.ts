import { emptyFinance, type FinanceState } from "@/lib/finance/model";
import { sampleFinanceStorage } from "@/lib/finance/client";
import { pilotRequest } from "@/lib/pilot/session";
import { loadWorkspace, commitSampleBatch } from "@/lib/activity/client";
import { assistantRequest, type AssistantStore } from "./service";
import { emptyThread, type AssistantRequest, type AssistantThread } from "./model";
import { compactThread, historyPage, type HistoryOptions, type HistoryPage, type HistorySegment } from "./history";
const storage = sampleFinanceStorage;
function sampleStore(email: string): AssistantStore {
  const read = () =>
    JSON.parse(
      localStorage.getItem(storage(email)) ?? '{"threads":{},"operations":{}}',
    ) as {
      threads: Record<string, AssistantThread>;
      operations: Record<string, AssistantThread>;
      segments?: Record<string, HistorySegment[]>;
      finance?: { revision: number; state: FinanceState };
      notifications?: import("@/lib/notifications/commands").NotificationPreference[];
    };
  const save: AssistantStore["save"] = async (thread, expected, key) => {
    const state = read();
    if (state.operations[key]) {
      if (state.operations[key].id !== thread.id)
        throw Error("Submission mismatch.");
      return state.operations[key];
    }
    if ((state.threads[thread.id]?.revision ?? 0) !== expected)
      throw Error("Conversation changed. Reload before retrying.");
    const compacted = compactThread(thread);
    if (compacted.archived.length) {
      state.segments ??= {};
      const segments = state.segments[thread.id] ??= [];
      segments.push({ index: (segments.at(-1)?.index ?? 0) + 1, messages: compacted.archived });
    }
    const next = {
      ...compacted.thread,
      revision: expected + 1,
      updatedAt: new Date().toISOString(),
    };
    state.threads[thread.id] = next;
    state.operations[key] = next;
    localStorage.setItem(storage(email), JSON.stringify(state));
    return next;
  };
  return {
    async finance() { return read().finance ?? { revision: 0, state: emptyFinance() }; },
    async notifications() { return read().notifications ?? []; },
    async load(id) {
      return read().threads[id] ?? null;
    },
    async result(id, key) {
      const result = read().operations[key];
      return result?.id === id ? result : null;
    },
    save,
    async history(id, options) {
      const state = read();
      const thread = state.threads[id];
      if (thread?.activityId && !(await loadWorkspace(true, email)).some(r => r.document.id === thread.activityId)) throw Error("Activity unavailable for this account.");
      return historyPage(state.segments?.[id] ?? [], options);
    },
    async rows() {
      return loadWorkspace(true, email);
    },
    async commit(thread, expected, key, _results, finance) {
      const state = read();
      if (state.operations[key]) return state.operations[key];
      if ((state.threads[thread.id]?.revision ?? 0) !== expected) throw Error("Conversation changed. Reload before retrying.");
      if (finance && (state.finance?.revision ?? 0) !== finance.expected) throw Error("Personal finances changed. Request a fresh review.");
      if (thread.pending?.notifications) {
        state.notifications ??= [];
        for (const command of thread.pending.notifications.commands) {
          const prior: import("@/lib/notifications/commands").NotificationPreference | undefined = state.notifications.find(p => p.recordId === command.recordId && p.expenseId === command.expenseId);
          if ((prior?.revision ?? 0) !== command.expected) throw Error("Notification preferences changed.");
          state.notifications = state.notifications.filter((p: import("@/lib/notifications/commands").NotificationPreference) => p !== prior);
          state.notifications.push({ ...command, revision: command.expected + 1 });
        }
      }
      if (thread.pending!.operations.length) commitSampleBatch(email, thread.pending!.operations);
      if (finance) {
        state.finance = { revision: finance.expected + 1, state: finance.state };
      }
      localStorage.setItem(storage(email), JSON.stringify(state));
      return save({ ...thread, pending: null, draft: null }, expected, key);
    },
  };
}
export async function loadAssistant(guest: boolean, email: string, id: string) {
  return guest
    ? sampleStore(email).load(id)
    : pilotRequest(`/api/workspace/assistant?id=${id}`);
}
export async function sendAssistant(
  guest: boolean,
  email: string,
  input: AssistantRequest,
): Promise<AssistantThread> {
  return guest
    ? assistantRequest(input, email, sampleStore(email))
    : pilotRequest("/api/workspace/assistant", {
        method: "POST",
        body: JSON.stringify(input),
      });
}

export type ThreadSummary = {
  id: string;
  activityId: string | null;
  title: string;
};
export async function listAssistant(
  guest: boolean,
  email: string,
): Promise<ThreadSummary[]> {
  if (!guest) return pilotRequest("/api/workspace/assistant?list=1");
  const state = JSON.parse(
    localStorage.getItem(storage(email)) ?? '{"threads":{}}',
  ) as { threads: Record<string, AssistantThread> };
  const allowed = new Set(
    (await loadWorkspace(true, email)).map((r) => r.document.id),
  );
  return Object.values(state.threads)
    .filter((t) => !t.activityId || allowed.has(t.activityId))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
    .map((t) => ({
      id: t.id,
      activityId: t.activityId,
      title:
        t.title ?? t.messages.find((m) => m.role === "user")?.text.slice(0, 80) ??
        "Conversation",
    }));
}

/** Resolve the same owner-scoped destination across devices. */
export async function resolveActivityConversation(guest: boolean, email: string, activityId: string): Promise<AssistantThread> {
  if (!guest) return pilotRequest("/api/workspace/assistant", {
    method: "POST", body: JSON.stringify({ action: "resolve", activityId }),
  });
  const rows = await loadWorkspace(true, email);
  if (!rows.some(r => r.kind === "activity" && r.document.id === activityId)) throw Error("Activity unavailable for this account.");
  const key = `splitflow-conversation-map:sample:${email}:${activityId}`;
  const existing = localStorage.getItem(key);
  if (existing) {
    const thread = await loadAssistant(true, email, existing);
    if (thread) return thread;
  }
  const latest = (await listAssistant(true, email)).find(t => t.activityId === activityId);
  const thread = latest ? await loadAssistant(true, email, latest.id) : null;
  const chosen = thread ?? emptyThread(crypto.randomUUID(), activityId);
  if (!thread) await sampleStore(email).save(chosen, 0, crypto.randomUUID());
  localStorage.setItem(key, chosen.id);
  return (await loadAssistant(true, email, chosen.id))!;
}

export async function loadAssistantHistory(guest: boolean, email: string, id: string, options: HistoryOptions = {}): Promise<HistoryPage> {
  if (guest) return sampleStore(email).history!(id, options);
  const params = new URLSearchParams({ id, history: "1" });
  if (options.before !== undefined) params.set("before", String(options.before));
  if (options.query) params.set("query", options.query);
  if (options.limit) params.set("limit", String(options.limit));
  return pilotRequest(`/api/workspace/assistant?${params}`);
}
