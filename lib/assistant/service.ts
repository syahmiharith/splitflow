import { validateFinanceLinks } from "@/lib/finance/shared-links";
import { prepareNotificationCommands, type NotificationPreference } from "@/lib/notifications/commands";
import { prepareFinanceCommands } from "./finance-tools";
import { applyFinanceCommand, type FinanceState } from "@/lib/finance/model";
import type { AssistantRequest, AssistantThread } from "./model";
import { emptyThread, addTurn, isConfirmation } from "./model";
import type { ToolActivity, Proposal } from "./model";
import { prepareBatch } from "@/lib/activity/operations";
import type { RecordRow } from "@/lib/activity/client";
export interface AssistantStore {
  load(id: string): Promise<AssistantThread | null>;
  result(id: string, key: string): Promise<AssistantThread | null>;
  save(
    thread: AssistantThread,
    expected: number,
    key: string,
  ): Promise<AssistantThread>;
  rows(): Promise<RecordRow[]>;
  finance?(): Promise<{ revision: number; state: FinanceState }>;
  notifications?(): Promise<NotificationPreference[]>;
  history?(id: string, options?: import("./history").HistoryOptions): Promise<import("./history").HistoryPage>;
  commit(
    thread: AssistantThread,
    expected: number,
    key: string,
    results: RecordRow[],
    finance?: { expected: number; state: FinanceState },
  ): Promise<AssistantThread>;
}
export async function assistantRequest(
  raw: AssistantRequest,
  email: string,
  store: AssistantStore,
  run?: (
    thread: AssistantThread,
    rows: RecordRow[],
    email: string,
    onTool: (event: ToolActivity) => Promise<void>,
  ) => Promise<{ text: string; proposal: Proposal | null }>,
) {
  const previous = await store.result(raw.id, `${raw.key}:done`);
  if (previous) return previous;
  let current =
    (await store.load(raw.id)) ?? emptyThread(raw.id, raw.activityId);
  if (current.revision !== raw.expected)
    throw Error(
      "This conversation changed. Reload before continuing; your message is retained.",
    );
  if (current.activityId !== raw.activityId)
    throw Error("Conversation context mismatch.");
  const rows = await store.rows();
  if (
    current.activityId &&
    !rows.some(
      (r) => r.kind === "activity" && r.document.id === current.activityId,
    )
  )
    throw Error("Activity unavailable for this account.");
  if (
    current.status === "processing" &&
    Date.now() - Date.parse(current.updatedAt) < 60000
  )
    throw Error("A reply is still running. Wait before retrying.");
  function finishReview(
    t: AssistantThread,
    status: "saved" | "discarded" | "superseded",
  ) {
    for (const message of t.messages)
      for (const part of message.parts ?? [])
        if (part.type === "review" && part.status === "pending")
          part.status = status;
  }
  if (raw.action === "prepare_finance") {
    if (!store.finance || !raw.financeCommands?.length) throw Error("Choose transactions to review.");
    const snapshot = await store.finance();
    let state = snapshot.state;
    for (const command of raw.financeCommands) { validateFinanceLinks(state, command, rows, email); state = applyFinanceCommand(state, command); }
    const prepared = prepareFinanceCommands(snapshot, raw.financeCommands);
    const next = structuredClone(current);
    finishReview(next, "superseded");
    const proposal: Proposal = { id: crypto.randomUUID(), operations: [], dependencies: [], previews: prepared.previews, finance: { expected: prepared.expected, commands: prepared.commands } };
    next.title ??= prepared.previews.length === 1 ? prepared.previews[0].title : "Personal finances";
    next.pending = proposal;
    next.draft = proposal;
    next.status = "idle";
    addTurn(next, "assistant", "Review these personal finance changes.");
    next.messages.at(-1)!.parts = [{ type: "review", proposal: structuredClone(proposal), status: "pending" }];
    return store.save(next, current.revision, `${raw.key}:done`);
  }
  const confirming =
    raw.action === "confirm" ||
    (raw.action === "send" &&
      raw.message &&
      isConfirmation(raw.message) &&
      current.pending);
  if (confirming) {
    if (!current.pending || raw.proposalId !== current.pending.id)
      throw Error("Review the current proposal before confirming.");
    let prepared: ReturnType<typeof prepareBatch>;
    let finance: { expected: number; state: FinanceState } | undefined;
    try {
      for (const dep of current.pending.dependencies) {
        const row = rows.find((r) => r.document.id === dep.id);
        if (!row || row.document.revision !== dep.revision)
          throw Error(
            "Related group or activity changed. Request a fresh review.",
          );
      }
      prepared = prepareBatch(rows, email, current.pending.operations);
      if (current.pending.notifications) {
        if (!store.notifications) throw Error("Notifications unavailable.");
        const validated = prepareNotificationCommands(prepared.rows, email, current.pending.notifications.commands, await store.notifications());
        if (validated.some((command, i) => command.expected !== current.pending!.notifications!.commands[i].expected)) throw Error("Notification preferences changed. Request a fresh review.");
      }

      if (current.pending.finance) {
        if (!store.finance) throw Error("Personal finance is unavailable.");
        const snapshot = await store.finance();
        if (snapshot.revision !== current.pending.finance.expected) throw Error("Personal finances changed. Request a fresh review.");
        let state = snapshot.state;
        for (const command of current.pending.finance.commands) {
          validateFinanceLinks(state, command, prepared.rows, email);
          state = applyFinanceCommand(state, command);
        }
        finance = { expected: snapshot.revision, state };
      }
    } catch (e) {
      const next = structuredClone(current);
      finishReview(next, "superseded");
      next.pending = null;
      next.status = "idle";
      addTurn(
        next,
        "assistant",
        `${e instanceof Error ? e.message : "Unable to prepare changes."} Nothing was confirmed. Request a fresh review.`,
      );
      return store.save(next, current.revision, `${raw.key}:done`);
    }
    const next = structuredClone(current);
    addTurn(next, "user", raw.message ?? "Confirm");
    addTurn(
      next,
      "assistant",
      "Saved.",
    );
    finishReview(next, "saved");
    next.messages.at(-1)!.parts = [
      {
        type: "result",
        proposalId: current.pending.id,
        previews: structuredClone(current.pending.previews),
        records: prepared.results.map((r) => ({
          id: r.document.id,
          kind: r.kind,
          revision: r.document.revision,
          title: r.kind === "activity" ? r.document.title : r.document.name,
        })),
      },
    ];
    next.lastResults = prepared.results;
    next.status = "idle";
    if (!next.activityId)
      next.activityId =
        prepared.results.find((r) => r.kind === "activity")?.document.id ??
        null;
    return store.commit(
      next,
      current.revision,
      `${raw.key}:done`,
      prepared.results,
      finance,
    );
  }
  if (raw.action === "attach") {
    if (
      current.pending ||
      !raw.targetActivityId ||
      !rows.some(
        (r) => r.kind === "activity" && r.document.id === raw.targetActivityId,
      )
    )
      throw Error("Review or discard the draft before changing context.");
    return store.save(
      { ...current, activityId: raw.targetActivityId, draft: null },
      current.revision,
      `${raw.key}:done`,
    );
  }
  if (raw.action === "manual") {
    const next = structuredClone(current);
    finishReview(next, "superseded");
    next.pending = null;
    next.status = "idle";
    addTurn(
      next,
      "assistant",
      "The private draft is retained. You can edit the prepared details manually or continue here.",
    );
    return store.save(next, current.revision, `${raw.key}:done`);
  }
  if (raw.action === "cancel") {
    const next = structuredClone(current);
    finishReview(next, "discarded");
    next.pending = null;
    next.draft = null;
    next.status = "idle";
    addTurn(
      next,
      "assistant",
      "Discarded the proposed changes. Shared records are unchanged.",
    );
    return store.save(next, current.revision, `${raw.key}:done`);
  }
  if (raw.action === "send" && !raw.message) throw Error("Enter a message.");
  if (
    raw.action === "retry" &&
    !current.messages.some((m) => m.role === "user")
  )
    throw Error("No message to retry.");
  current = structuredClone(current);
  if (raw.manualContext) current.manualContext = raw.manualContext;
  if (raw.action === "send") addTurn(current, "user", raw.message!);
  finishReview(current, "superseded");
  for (const message of current.messages)
    for (const part of message.parts ?? [])
      if (part.type === "tool" && part.status === "running")
        part.status = "failed";
  current.pending = null;
  addTurn(current, "assistant", "");
  current.messages.at(-1)!.parts = [];
  current.status = "processing";
  current.updatedAt = new Date().toISOString();
  current = await store.save(current, current.revision, `${raw.key}:started`);
  let next = structuredClone(current);
  let toolIndex = 0;
  const onTool = async (event: ToolActivity) => {
    const parts = next.messages.at(-1)!.parts!;
    const existing = parts.find((p) => p.type === "tool" && p.id === event.id);
    if (existing) Object.assign(existing, event);
    else parts.push({ type: "tool", ...event });
    next.updatedAt = new Date().toISOString();
    next = await store.save(
      next,
      next.revision,
      `${raw.key}:tool:${toolIndex++}`,
    );
  };
  try {
    if (!run) throw Error("Assistant unavailable");
    const result = await run(next, rows, email, onTool);
    next.pending = result.proposal;
    if (result.proposal) next.draft = result.proposal;
    next.status = "idle";
    next.messages.at(-1)!.text = result.text;
    if (result.proposal)
      next.messages
        .at(-1)!
        .parts!.push({
          type: "review",
          proposal: structuredClone(result.proposal),
          status: "pending",
        });
  } catch {
    next.status = "unavailable";
    next.messages.at(-1)!.text =
      "Assistant unavailable. Your message and private draft are saved. Retry or use Enter manually.";
    for (const part of next.messages.at(-1)!.parts ?? [])
      if (part.type === "tool" && part.status === "running")
        part.status = "failed";
  }
  return store.save(next, next.revision, `${raw.key}:done`);
}
