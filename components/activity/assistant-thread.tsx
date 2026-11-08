"use client";
import { useEffect, useRef } from "react";
import type { AssistantThread as Thread, Preview } from "@/lib/assistant/model";
export function AssistantThread({
  thread,
  busy,
  error,
  onConfirm,
  onCancel,
  onRetry,
  onManual,
}: {
  thread: Thread | null;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onManual: (preview?: Preview) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [thread?.messages.length, thread?.pending?.id]);
  if (!thread?.messages.length && !error) return null;
  return (
    <section
      aria-label="Private assistant conversation"
      className="sf-assistant-thread"
    >
      <p className="sf-assistant-private">
        Private conversation
      </p>
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
          <p className="whitespace-pre-wrap">{m.text}</p>
        </div>
      ))}
      {thread?.pending && (
        <section
          aria-label="Review proposed changes"
          className="sf-assistant-review"
        >
          <h2>{thread.pending.previews.length === 1 ? `Review ${thread.pending.previews[0].title}` : `Review ${thread.pending.previews.length} changes`}</h2>
          {thread.pending.previews.map((p, i) => (
            <div key={i}>
              <h3>{p.title}</h3>
              <ul>
                {p.lines.filter(Boolean).map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>
            </div>
          ))}
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy}
              onClick={onConfirm}
              className="sf-assistant-confirm"
            >
              Confirm changes
            </button>
            <button disabled={busy} onClick={onCancel}>
              Discard
            </button>
          </div>
          <p className="text-xs text-app-muted">
            Reply “confirm” to save, or describe a change.
          </p>
        </section>
      )}
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
      {thread?.pending && (
        <button
          disabled={busy}
          className="text-xs underline"
          onClick={() =>
            onManual(thread.pending?.previews.find((p) => p.expense))
          }
        >
          Enter manually
        </button>
      )}
      <div ref={end} />
    </section>
  );
}
