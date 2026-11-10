"use client";
import { Dialog } from "@/components/controls/dialog";
import { Select } from "@/components/controls/select";
import { useEffect, useRef, useState } from "react";
import { GroupChooser } from "./group-chooser";
import { expenseFromGroup, type SavedGroup } from "@/lib/pilot/groups";
import { ConversationPreview } from "./conversation-preview";
import { ArrowUp, PenLine, X } from "lucide-react";
import { ExpenseForm } from "./pilot-expense-form";
import { pilotRequest } from "@/lib/pilot/session";
import { type Expense, type Split } from "@/lib/pilot/model";
import type { Conversation } from "@/lib/pilot/conversation";
export function SplitConversation({
  email,
  conversation,
  id,
  split,
  previousSplits,
  onSaved,
  onPublish,
}: {
  previousSplits: Split[];
  email: string;
  conversation?: Conversation;
  id: string;
  split?: Split;
  onSaved: (conversation: Conversation) => void;
  onPublish: (expense: Expense) => Promise<void>;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reuse, setReuse] = useState("");
  const [groupPreset, setGroupPreset] = useState<SavedGroup>();
  const [manual, setManual] = useState(false);
  const [review, setReview] = useState(false);
  const [pending, setPending] = useState<{ body: string; key: string }>();
  const guard = useRef(false);
  const reviewRevision = useRef(conversation?.revision ?? 0);
  const end = useRef<HTMLDivElement>(null);
  const draft = split?.expense ?? conversation?.draft;
  const reused = previousSplits.find((s) => s.id === reuse)?.expense;
  const manualInitial = groupPreset
    ? expenseFromGroup(groupPreset)
    : reused
      ? {
          title: "",
          mode: "paid" as const,
          participants: reused.participants.map((p) => ({ ...p, paid: 0 })),
          items: [
            {
              name: "Dinner",
              amount: 0,
              included: reused.participants.map((p) => p.email),
            },
          ],
        }
      : (draft ?? undefined);
  const storageKey = `splitflow-conversation-pending:${email}:${id}`;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setPending(JSON.parse(raw));
    } catch {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [conversation?.messages.length, busy]);
  async function save(
    payload: { message?: string; draft?: Expense },
    retry = false,
  ) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    const body = JSON.stringify({
      id,
      expected: payload.draft
        ? reviewRevision.current
        : (conversation?.revision ?? 0),
      ...payload,
    });
    const op = retry && pending ? pending : { body, key: crypto.randomUUID() };
    setPending(op);
    localStorage.setItem(storageKey, JSON.stringify(op));
    try {
      const result: Conversation = await pilotRequest(
        "/api/pilot/conversations",
        {
          method: "POST",
          body: JSON.stringify({ ...JSON.parse(op.body), key: op.key }),
        },
      );
      onSaved(result);
      setInput((current) =>
        current === JSON.parse(op.body).message ? "" : current,
      );
      setPending(undefined);
      localStorage.removeItem(storageKey);
      setManual(false);
      setReview(false);
      setGroupPreset(undefined);
      setReuse("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save. Retry your message.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  async function publish(expense: Expense) {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      if (reviewRevision.current !== (conversation?.revision ?? 0))
        throw new Error(
          "This draft changed. Close review and review the current version before publishing.",
        );
      await onPublish(expense);
      setManual(false);
      setReview(false);
      setGroupPreset(undefined);
      setReuse("");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to publish. Your draft remains available.",
      );
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }
  return (
    <section
      className="conversation-workspace flex min-h-full flex-col"
      aria-label="Split conversation"
      data-testid="conversation-workspace"
    >
      <div className="mx-auto flex w-full max-w-[832px] flex-1 flex-col px-4 pb-6 pt-6 md:px-8">
        {!conversation?.messages.length && !split && !pending ? (
          <div className="my-auto py-12 md:py-20">
            <h2 className="text-2xl font-semibold tracking-tight">
              What are we splitting?
            </h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-app-muted">
              Tell me about the dinner or outing. We’ll work out the details,
              then review everyone’s share together.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {[
                "A dinner I paid for",
                "An outing with different shares",
                "Plan an expense together",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="min-h-11 rounded-lg border border-app-border px-3 text-sm hover:bg-slate-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div
            className="space-y-7 pb-7"
            role="log"
            aria-label="Conversation messages"
          >
            {conversation?.messages.map((message) => (
              <div
                key={message.id}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[88%] rounded-2xl bg-slate-100 px-4 py-3 text-sm leading-6"
                    : "max-w-full text-sm leading-7"
                }
              >
                <span className="sr-only">
                  {message.role === "user" ? "You" : "SplitFlow"}:{" "}
                </span>
                <p className="whitespace-pre-wrap break-words">
                  {message.content}
                </p>
              </div>
            ))}
            {pending &&
              JSON.parse(pending.body).message &&
              conversation?.messages.at(-2)?.content !==
                JSON.parse(pending.body).message && (
                <div className="ml-auto max-w-[88%] rounded-2xl bg-slate-100 px-4 py-3 text-sm leading-6">
                  <span className="sr-only">You: </span>
                  <p className="whitespace-pre-wrap break-words">
                    {JSON.parse(pending.body).message}
                  </p>
                  <p className="mt-1 text-xs text-app-muted">
                    {busy ? "Sending…" : "Save not acknowledged"}
                  </p>
                </div>
              )}
          </div>
        )}
        {draft && (
          <ConversationPreview
            draft={draft}
            split={split}
            email={email}
            disabled={busy || Boolean(pending)}
            onReview={() => {
              reviewRevision.current = conversation?.revision ?? 0;
              setReview(true);
            }}
          />
        )}
        {busy && (
          <p role="status" className="mb-4 text-sm text-app-muted">
            {manual || review ? "Saving…" : "Preparing a reply…"}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {pending && !busy && (
          <div className="mb-4 space-y-2 text-sm">
            <p>Your last save hasn’t been acknowledged.</p>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => void save({}, true)}
                className="min-h-11 font-semibold underline"
              >
                Retry saved submission
              </button>
              <button
                onClick={async () => {
                  try {
                    const rows: Conversation[] = await pilotRequest(
                      "/api/pilot/conversations",
                    );
                    const current = rows.find((row) => row.id === id);
                    if (current) onSaved(current);
                    setInput(JSON.parse(pending.body).message ?? input);
                    setPending(undefined);
                    localStorage.removeItem(storageKey);
                    setError("");
                  } catch {
                    setError(
                      "Couldn’t refresh this conversation. Your message is retained.",
                    );
                  }
                }}
                className="min-h-11 underline"
              >
                Keep text and use current version
              </button>
            </div>
          </div>
        )}
        <div ref={end} />
      </div>
      <div className="sticky bottom-0 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 md:px-8">
        <form
          className="mx-auto max-w-3xl rounded-2xl border border-slate-300 bg-white p-3 focus-within:border-slate-500"
          onSubmit={(event) => {
            event.preventDefault();
            if (input.trim() && !pending) void save({ message: input });
          }}
        >
          <label className="sr-only" htmlFor="split-message">
            Message SplitFlow
          </label>
          <textarea
            id="split-message"
            rows={2}
            maxLength={2000}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Describe an expense, ask a question, or adjust your draft…"
            className="block w-full resize-none border-0 bg-transparent p-1 text-sm leading-6 placeholder:text-app-muted focus:outline-none"
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (input.trim() && !busy && !pending)
                  void save({ message: input });
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                disabled={busy || Boolean(pending)}
                onClick={() => {
                  if (split) location.href = `/?split=${split.id}`;
                  else {
                    reviewRevision.current = conversation?.revision ?? 0;
                    setManual(true);
                  }
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border-transparent px-2 text-sm font-normal text-app-muted hover:bg-slate-50"
              >
                <PenLine className="h-4 w-4" aria-hidden="true" />
                Enter manually
              </button>
              <GroupChooser
                email={email}
                seed={draft?.participants.map(({ name, email }) => ({
                  name,
                  email,
                }))}
                canUse={!draft}
                disabled={busy || Boolean(pending)}
                onUse={(group) => {
                  setGroupPreset(group);
                  setReuse("");
                  reviewRevision.current = conversation?.revision ?? 0;
                  setManual(true);
                }}
              />
            </div>
            <button
              type="submit"
              aria-label="Send message"
              disabled={busy || !input.trim() || Boolean(pending)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-app-text hover:bg-slate-700 border-transparent text-white disabled:opacity-40"
            >
              <ArrowUp className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>
        <p className="mx-auto mt-2 max-w-3xl text-center text-xs text-app-muted">
          Drafts stay private. Review before publishing.
        </p>
      </div>
      <Dialog
        open={manual || review}
        title={review ? "Review split" : "Enter expense"}
        busy={busy}
        onClose={() => {
          setManual(false);
          setReview(false);
        }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-app-border bg-white px-5 py-3">
          <span className="text-sm font-semibold">
            {review ? "Review split" : "Enter expense"}
          </span>
          <button
            type="button"
            aria-label="Close review"
            disabled={busy}
            onClick={() => {
              setManual(false);
              setReview(false);
            }}
            className="grid h-11 w-11 place-items-center rounded-lg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {manual && !split && previousSplits.length > 0 && (
          <label className="block px-5 pt-4 text-sm">
            Reuse people from a previous split
            <Select
              value={reuse}
              onChange={(event) => {
                setGroupPreset(undefined);
                setReuse(event.target.value);
              }}
              className="mt-2 block w-full rounded-lg border border-app-border p-3"
            >
              <option value="">Choose people (optional)</option>
              {previousSplits.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.expense.title}
                </option>
              ))}
            </Select>
          </label>
        )}
        {(manual || review) && (
          <ExpenseForm
            key={`${id}-${manual}-${review}-${reuse}-${groupPreset?.id ?? ""}`}
            email={email}
            initial={review ? (draft ?? undefined) : manualInitial}
            startInReview={review && Boolean(draft)}
            busy={busy}
            onSave={(expense) => publish(expense)}
            onSaveDraft={(expense) => save({ draft: expense })}
          />
        )}
        {error && (
          <p role="alert" className="p-5 text-sm text-red-700">
            {error}
          </p>
        )}
      </Dialog>
    </section>
  );
}
