import { z } from "zod";
import type { Operation, RecordRow } from "@/lib/activity/client";
import type { Expense } from "@/lib/pilot/model";
export type Preview = {
  title: string;
  lines: string[];
  expense?: Expense;
  activityId?: string;
  expenseId?: string;
};
export type Proposal = {
  id: string;
  operations: Operation[];
  dependencies: { id: string; revision: number }[];
  previews: Preview[];
};
export type Turn = {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: string;
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
};
export const requestSchema = z.object({
  id: z.uuid(),
  key: z.uuid(),
  expected: z.number().int().min(0),
  activityId: z.uuid().nullable(),
  action: z.enum(["send", "confirm", "cancel", "retry", "attach", "manual"]),
  message: z.string().trim().min(1).max(4000).optional(),
  proposalId: z.uuid().optional(),
  targetActivityId: z.uuid().optional(),
  manualContext: z.string().max(20000).optional(),
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
