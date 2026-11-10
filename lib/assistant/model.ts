import { z } from "zod";
import { financeCommandSchema } from "@/lib/finance/model";
import type { Operation, RecordRow } from "@/lib/activity/client";
import type { Expense } from "@/lib/pilot/model";
import type { SpendingPlan, SpendingPlanSummary } from "@/lib/activity/planning";
export type Preview = {
  title: string;
  /** Presentation-only correlation within a proposal, never a mutation or navigation reference. */
  entity?: { kind: "group" | "activity" | "expense" | "repayment" | "account" | "category" | "transaction" | "schedule" | "goal"; id: string };
  group?: { name: string; people: { name: string; email: string; status: "joined" | "invited" }[]; delivery: "held" | "queued_on_confirm" };
  plan?: { current: SpendingPlan; previous?: SpendingPlan; summary: SpendingPlanSummary; reason: string; classificationChanges?: string[] };
  lines: string[];
  // Server-derived display summary; historical previews may omit it.
  summary?: { currency?: string; amount?: number; suffix?: string; text: string };
  transfer?: { currency?: string; from: string; to: string; amount: number; status: "reported" | "confirmed" | "disputed"; claimStatus?: "pending" | "agreed" | "disputed"; reference?: string };
  expense?: Expense;
  activityId?: string;
  expenseId?: string;
};
export type Proposal = {
  id: string;
  notifications?: { commands: import("@/lib/notifications/commands").ReviewedNotification[] };
  finance?: { expected: number; commands: import("@/lib/finance/model").FinanceCommand[] };
  operations: Operation[];
  dependencies: { id: string; revision: number }[];
  previews: Preview[];
};
export type ToolActivity = {
  id: string;
  label: string;
  status: "running" | "complete" | "failed";
};
export type TurnPart =
  | ({ type: "tool" } & ToolActivity)
  | {
      type: "review";
      proposal: Proposal;
      status: "pending" | "saved" | "discarded" | "superseded";
    }
  | {
      type: "result";
      proposalId: string;
      previews: Preview[];
      records: { id: string; kind: string; revision: number; title: string }[];
    };
export type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
  parts?: TurnPart[];
};
export type AssistantThread = {
  id: string;
  revision: number;
  activityId: string | null;
  messages: Turn[];
  status: "idle" | "processing" | "unavailable";
  pending: Proposal | null;
  draft: Proposal | null;
  updatedAt: string;
  lastResults?: RecordRow[];
  manualContext?: string;
  /** Archived turns are loaded separately under this same conversation ID. */
  historyCount?: number;
  title?: string;
};
export const requestSchema = z.object({
  id: z.uuid(),
  key: z.uuid(),
  expected: z.number().int().min(0),
  activityId: z.uuid().nullable(),
  action: z.enum(["send", "confirm", "cancel", "retry", "attach", "manual", "prepare_finance"]),
  message: z.string().trim().min(1).max(4000).optional(),
  proposalId: z.uuid().optional(),
  targetActivityId: z.uuid().optional(),
  manualContext: z.string().max(20000).optional(),
  financeCommands: z.array(financeCommandSchema).min(1).max(500).optional(),
});
export type AssistantRequest = z.infer<typeof requestSchema>;
export function emptyThread(
  id: string,
  activityId: string | null,
): AssistantThread {
  return {
    id,
    activityId,
    revision: 0,
    messages: [],
    status: "idle",
    pending: null,
    draft: null,
    updatedAt: new Date().toISOString(),
  };
}
export function addTurn(
  thread: AssistantThread,
  role: Turn["role"],
  text: string,
) {
  thread.messages.push({
    id: crypto.randomUUID(),
    role,
    text,
    at: new Date().toISOString(),
  });
  thread.updatedAt = new Date().toISOString();
}
export const isConfirmation = (text: string) =>
  /^(yes|confirm|confirmed|yes[, ]+confirm|publish|yes[, ]+publish|looks right[, ]+publish it)[.!]?$/i.test(
    text.trim(),
  );
