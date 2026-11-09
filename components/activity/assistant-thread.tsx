"use client";
import { ActionResult } from "./action-result";
import { useEffect, useRef } from "react";
import { Check, ChevronRight, LoaderCircle } from "lucide-react";
import type {
  AssistantThread as Thread,
  Preview,
  Proposal,
  TurnPart,
} from "@/lib/assistant/model";
export function AssistantThread({
  thread,
  busy,
  error,
  onConfirm,
  onCancel,
  onRetry,
  onManual,
  onOpen,
}: {
  thread: Thread | null;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onManual: (preview?: Preview) => void;
  onOpen?: (id: string) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [thread?.messages.length, thread?.pending?.id]);
  if (!thread?.messages.length && !error) return null;
  function review(proposal: Proposal, status: string) {
    const active = status === "pending" && thread?.pending?.id === proposal.id;
    return (
      <section
        className="sf-chat-card"
        aria-label={active ? "Review proposed changes" : "Previous review"}
      >
        <div className="sf-chat-card-heading">
          <span>{active ? "Ready to confirm" : status === "saved" ? "Saved" : status === "discarded" ? "Discarded" : "Superseded"}</span>
        </div>
        {proposal.previews.map((p, i) =>
          !p.expense && p.lines[0]?.startsWith("Create ") && p.activityId &&
          proposal.previews.some(other => (other.expense || other.plan) && other.activityId === p.activityId) ? (
            <p key={i} className="sf-chat-card-context">New activity · {p.title}</p>
          ) : <ActionResult key={i} preview={p} review saved={!active} />,
        )}
        {active && (
          <>
            <div className="sf-chat-card-actions">
              <button
                className="sf-assistant-confirm"
                disabled={busy}
                onClick={onConfirm}
              >
                {busy ? "Saving…" : "Confirm changes"}
              </button>
              <button disabled={busy} onClick={onCancel}>
                Discard
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  onManual(proposal.previews.find((p) => p.expense))
                }
              >
                Edit
              </button>
            </div>
          </>
        )}
      </section>
    );
  }
  function part(p: TurnPart, i: number) {
    if (p.type === "tool")
      return (
        <div key={i} className="sf-tool-activity" role="status">
          {p.status === "running" ? (
            <LoaderCircle size={14} className="sf-tool-spinner" />
          ) : p.status === "complete" ? (
            <Check size={14} />
          ) : null}
          <span>
            {p.label}
            {p.status === "failed"
              ? " · interrupted"
              : p.status === "running"
                ? "…"
                : ""}
          </span>
        </div>
      );
    if (p.type === "review")
      return <div key={i}>{review(p.proposal, p.status)}</div>;
    if (thread?.messages.some(m => m.parts?.some(part => part.type === "review" && part.proposal.id === p.proposalId && part.status === "saved"))) return null;
    return (
      <section
        key={i}
        className="sf-chat-card sf-chat-result"
        aria-label="Saved result"
      >
        <div className="sf-chat-card-heading">
          <Check size={15} />
          <span>Recorded</span>
        </div>
        {p.previews
          .filter(
            (preview) =>
              preview.expense ||
              !p.previews.some(
                (other) =>
                  other.expense && other.activityId === preview.activityId,
              ),
          )
          .map((preview, j) => (
            <ActionResult key={j} preview={preview} />
          ))}
        {onOpen && p.records.some((r) => r.kind === "activity") && (
          <div className="sf-chat-card-actions">
            {Array.from(
              new Map(p.records.filter((r) => r.kind === "activity").map((r) => [r.id, r])).values(),
            ).map((r) => (
              <button key={r.id} onClick={() => onOpen(r.id)}>
                Open activity <ChevronRight size={14} />
              </button>
            ))}
          </div>
        )}

      </section>
    );
  }
  const hasStoredReview = thread?.messages.some((m) =>
    m.parts?.some(
      (p) => p.type === "review" && p.proposal.id === thread.pending?.id,
    ),
  );
  return (
    <section
      aria-label="Private assistant conversation"
      className="sf-assistant-thread"
    >
      <p className="sf-assistant-private">Private conversation</p>
      {thread?.messages.map((m) => (
        <div
          key={m.id}
          className={
            m.role === "user" ? "sf-message-own" : "sf-assistant-reply"
          }
        >
          <span className="sr-only">
            {m.role === "user" ? "You" : "SplitFlow"}:{" "}
          </span>
          {m.parts?.filter((p) => p.type === "tool").map(part)}
          {m.text && <p className="whitespace-pre-wrap">{m.text}</p>}
          {m.parts?.filter((p) => p.type !== "tool").map(part)}
        </div>
      ))}
      {thread?.pending && !hasStoredReview && review(thread.pending, "pending")}
      {(thread?.status === "unavailable" ||
        thread?.status === "processing" ||
        error) && (
        <div role="status" className="sf-assistant-status">
          {busy
            ? "Working on your request…"
            : error ||
              (thread?.status === "processing"
                ? "A previous reply was interrupted. Retry after a minute."
                : "Assistant unavailable")}
          <div className="flex gap-4">
            <button disabled={busy} onClick={onRetry}>
              Retry
            </button>
            <button
              disabled={busy}
              onClick={() =>
                onManual(thread?.draft?.previews.find((p) => p.expense))
              }
            >
              Enter manually
            </button>
          </div>
        </div>
      )}
      <div ref={end} />
    </section>
  );
}
