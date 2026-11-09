"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadAssistant,
  resolveActivityConversation,
  sendAssistant,
  listAssistant,
  type ThreadSummary,
} from "@/lib/assistant/client";
import {
  emptyThread,
  addTurn,
  type AssistantThread,
  type AssistantRequest,
} from "@/lib/assistant/model";
export function useAssistant(
  guest: boolean,
  email: string,
  activityId: string | null,
  ready: boolean,
  onSaved: (thread: AssistantThread) => Promise<void>,
) {
  const scope = `splitflow-assistant-thread:${guest ? "sample" : "real"}:${email}:`;
  const key = scope + (activityId ?? "home");
  const [recents, setRecents] = useState<ThreadSummary[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [thread, setThread] = useState<AssistantThread | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const guard = useRef(false),
    identity = useRef(key);
  identity.current = `${key}:${thread?.id ?? ""}`;
  const load = useCallback(async () => {
    if (activityId) return resolveActivityConversation(guest, email, activityId);
    const id =
      localStorage.getItem(key) ??
      (await listAssistant(guest, email)).find(
        (t) => t.activityId === activityId,
      )?.id ??
      crypto.randomUUID();
    localStorage.setItem(key, id);
    const saved = await loadAssistant(guest, email, id);
    const result = saved ?? emptyThread(id, activityId);
    const retained = localStorage.getItem(`${key}:submission`);
    if (retained && !saved) {
      const request = JSON.parse(retained) as AssistantRequest;
      if (request.message) addTurn(result, "user", request.message);
      result.status = "unavailable";
    }
    return result;
  }, [key, guest, email, activityId]);
  useEffect(() => {
    let active = true;
    setThread(null);
    setError("");
    if (ready)
      void load()
        .then((value) => {
          if (active) {
            setThread(value);
            setLoadedKey(key);
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [load, ready]);
  useEffect(() => {
    let active = true;
    setRecents([]);
    if (ready)
      void listAssistant(guest, email)
        .then((rows) => {
          if (active) setRecents(rows);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [guest, email, ready, thread?.revision]);
  async function open(summary: ThreadSummary) {
    const saved = await loadAssistant(guest, email, summary.id);
    if (!saved) return;
    localStorage.setItem(scope + (saved.activityId ?? "home"), saved.id);
    setThread(saved);
    setLoadedKey(scope + (saved.activityId ?? "home"));
  }
  async function send(
    action: AssistantRequest["action"],
    message?: string,
    manualContext?: string,
  ) {
    if (guard.current) throw Error("Wait for the current reply.");
    if (!thread) {
      try {
        const value = await load();
        setThread(value);
        setLoadedKey(key);
        setError("");
        return value;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load.");
        throw e;
      }
    }
    guard.current = true;
    setBusy(true);
    setError("");
    const started = identity.current;
    const pendingKey = `${key}:submission`;
    const stored = localStorage.getItem(pendingKey);
    const request: AssistantRequest = stored
      ? JSON.parse(stored)
      : {
          id: thread.id,
          key: crypto.randomUUID(),
          expected: thread.revision,
          activityId: thread.activityId,
          action,
          message,
          manualContext,
          proposalId: thread.pending?.id,
        };
    localStorage.setItem(pendingKey, JSON.stringify(request));
    if (!stored && action === "send" && message) {
      const optimistic = structuredClone(thread);
      addTurn(optimistic, "user", message);
      optimistic.status = "processing";
      setThread(optimistic);
    }
    let polling = true;
    const timer = setInterval(() => {
      if (!guest)
        void loadAssistant(guest, email, thread.id)
          .then((value) => {
            if (polling && value && identity.current === started)
              setThread(value);
          })
          .catch(() => {});
    }, 1200);
    try {
      const next = await sendAssistant(guest, email, request);
      polling = false;
      localStorage.removeItem(pendingKey);
      if (next.activityId)
        localStorage.setItem(scope + next.activityId, next.id);
      if (identity.current === started) {
        setThread(next);
        if (
          next.lastResults?.length &&
          next.revision !== thread.revision &&
          next.messages.at(-1)?.text.startsWith("Saved.")
        )
          await onSaved(next);
      }
      return next;
    } catch (e) {
      if (identity.current === started) {
        setError(e instanceof Error ? e.message : "Unable to save.");
        const latest = await loadAssistant(guest, email, thread.id).catch(
          () => null,
        );
        if (latest) {
          setThread(latest);
          if (latest.revision > thread.revision)
            localStorage.removeItem(pendingKey);
        }
      }
      throw e;
    } finally {
      polling = false;
      clearInterval(timer);
      guard.current = false;
      setBusy(false);
    }
  }
  async function attach(activity: string) {
    if (!thread) return;
    const next = await sendAssistant(guest, email, {
      id: thread.id,
      key: crypto.randomUUID(),
      expected: thread.revision,
      activityId: thread.activityId,
      action: "attach",
      targetActivityId: activity,
    });
    localStorage.setItem(scope + activity, next.id);
    setThread(next);
  }
  function fresh() {
    const id = crypto.randomUUID();
    localStorage.setItem(scope + "home", id);
    setThread(emptyThread(id, null));
    setLoadedKey(scope + "home");
    setError("");
  }
  return {
    thread: loadedKey === key ? thread : null,
    busy,
    error,
    send,
    fresh,
    attach,
    recents,
    open,
  };
}
