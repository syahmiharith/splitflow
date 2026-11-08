import { pilotRequest } from "@/lib/pilot/session";
import { loadWorkspace, commitSampleBatch } from "@/lib/activity/client";
import { assistantRequest, type AssistantStore } from "./service";
import type { AssistantRequest, AssistantThread } from "./model";
const storage = (email: string) =>
  `splitflow-private-assistant:sample:${email}`;
function sampleStore(email: string): AssistantStore {
  const read = () =>
    JSON.parse(
      localStorage.getItem(storage(email)) ?? '{"threads":{},"operations":{}}',
    ) as {
      threads: Record<string, AssistantThread>;
      operations: Record<string, AssistantThread>;
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
    const next = {
      ...thread,
      revision: expected + 1,
      updatedAt: new Date().toISOString(),
    };
    state.threads[thread.id] = next;
    state.operations[key] = next;
    localStorage.setItem(storage(email), JSON.stringify(state));
    return next;
  };
  return {
    async load(id) {
      return read().threads[id] ?? null;
    },
    async result(id, key) {
      const result = read().operations[key];
      return result?.id === id ? result : null;
    },
    save,
    async rows() {
      return loadWorkspace(true, email);
    },
    async commit(thread, expected, key) {
      commitSampleBatch(email, thread.pending!.operations);
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
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 30)
    .map((t) => ({
      id: t.id,
      activityId: t.activityId,
      title:
        t.messages.find((m) => m.role === "user")?.text.slice(0, 80) ??
        "Conversation",
    }));
}
