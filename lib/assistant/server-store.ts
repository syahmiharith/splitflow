import { loadFinance } from "@/lib/finance/server";
import { database } from "@/lib/pilot/server";
import type { AssistantThread } from "./model";
import type { AssistantStore } from "./service";
export function serverStore(user: {
  id: string;
  email: string;
}): AssistantStore {
  const owner = encodeURIComponent(user.id);
  return {
    finance: () => loadFinance(user.id),
    async notifications() {
      const result: import("@/lib/notifications/commands").NotificationPreference[] = [];
      for (let offset = 0; ; offset += 100) {
        const page = await database(`notification_preferences?owner=eq.${owner}&select=*&order=record_id.asc,task_key.asc&limit=100&offset=${offset}`);
        result.push(...page.map((p: {record_id:string; expense_id:string|null; enabled:boolean; muted:boolean; stopped:boolean; snoozed_until:string|null; due_at:string|null; revision:number}) => ({ recordId:p.record_id,expenseId:p.expense_id,enabled:p.enabled,muted:p.muted,stopped:p.stopped,snoozedUntil:p.snoozed_until,dueAt:p.due_at,revision:p.revision })));
        if (page.length < 100) return result;
      }
    },
    async load(id) {
      const rows = await database(
        `assistant_threads?owner=eq.${owner}&id=eq.${id}&select=document`,
      );
      return rows[0]?.document ?? null;
    },
    async history(id, options = {}) {
      return database("rpc/read_assistant_history", {
        method: "POST", body: JSON.stringify({ p_owner: user.id, p_id: id, p_before: options.before ?? null, p_query: options.query ?? "", p_limit: options.limit ?? 1 }),
      });
    },
    async result(id, key) {
      const rows = await database(
        `assistant_operations?owner=eq.${owner}&thread_id=eq.${id}&key=eq.${encodeURIComponent(key)}&select=result`,
      );
      return rows[0]?.result ?? null;
    },
    async rows() {
      const result: import("@/lib/activity/client").RecordRow[] = [];
      const membership = encodeURIComponent(`{"${user.email.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"}`);
      for (let offset = 0; ; offset += 100) {
        const page = await database(`activity_records?members=cs.${membership}&select=kind,document&order=id.asc&limit=100&offset=${offset}`);
        result.push(...page);
        if (page.length < 100) return result;
      }
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
    async commit(thread, expected, key, results, finance) {
      return database(thread.pending?.notifications ? "rpc/commit_assistant_notifications" : finance ? "rpc/commit_assistant_finance" : "rpc/commit_assistant_batch", {
        method: "POST",
        body: JSON.stringify({
          p_owner: user.id,
          p_id: thread.id,
          p_expected: expected,
          p_key: key,
          p_document: thread,
          p_results: results,
          ...((finance || thread.pending?.notifications) ? { p_finance_expected: finance?.expected ?? null, p_finance_state: finance?.state ?? null } : {}),
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
