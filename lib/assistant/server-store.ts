import { database } from "@/lib/pilot/server";
import type { AssistantThread } from "./model";
import type { AssistantStore } from "./service";
export function serverStore(user: {
  id: string;
  email: string;
}): AssistantStore {
  const owner = encodeURIComponent(user.id);
  return {
    async load(id) {
      const rows = await database(
        `assistant_threads?owner=eq.${owner}&id=eq.${id}&select=document`,
      );
      return rows[0]?.document ?? null;
    },
    async result(id, key) {
      const rows = await database(
        `assistant_operations?owner=eq.${owner}&thread_id=eq.${id}&key=eq.${encodeURIComponent(key)}&select=result`,
      );
      return rows[0]?.result ?? null;
    },
    async rows() {
      return database(
        `activity_records?members=cs.${encodeURIComponent(`{"${user.email.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"}`)}&select=kind,document`,
      );
    },
    async save(thread, expected, key) {
      return database("rpc/save_assistant_thread", {
        method: "POST",
        body: JSON.stringify({
          p_owner: user.id,
          p_id: thread.id,
          p_expected: expected,
          p_key: key,
          p_document: thread,
        }),
      });
    },
    async commit(thread, expected, key, results) {
      return database("rpc/commit_assistant_batch", {
        method: "POST",
        body: JSON.stringify({
          p_owner: user.id,
          p_id: thread.id,
          p_expected: expected,
          p_key: key,
          p_document: thread,
          p_results: results,
        }),
      });
    },
  };
}
export async function assertThreadAccess(
  store: AssistantStore,
  thread: AssistantThread | null,
) {
  if (
    thread?.activityId &&
    !(await store.rows()).some(
      (r) => r.kind === "activity" && r.document.id === thread.activityId,
    )
  )
    throw Error("Activity unavailable for this account.");
}
