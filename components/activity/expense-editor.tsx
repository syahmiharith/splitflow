"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExpenseForm } from "@/components/pilot-expense-form";
import { pilotRequest } from "@/lib/pilot/session";
import type { Expense } from "@/lib/pilot/model";
export function ActivityExpenseEditor({
  guest,
  email,
  activityId,
  slot,
  initial,
  original,
  busy,
  onSave,
}: {
  guest: boolean;
  email: string;
  activityId: string;
  slot: string;
  initial: Expense;
  original?: Expense;
  busy: boolean;
  onSave: (expense: Expense, reason: string) => Promise<void>;
}) {
  const path = `/api/workspace/drafts?activity=${activityId}&slot=${slot}`,
    key = `splitflow-activity-draft:${guest ? "sample" : "real"}:${email}:${activityId}:${slot}`;
  const [loaded, setLoaded] = useState(guest),
    [saved, setSaved] = useState<Expense>(),
    [status, setStatus] = useState(""),
    [version, setVersion] = useState(0),
    [saving, setSaving] = useState(false),
    [recovery, setRecovery] = useState<Expense>();
  const starting = useRef(original ?? initial);
  const revision = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined),
    queue = useRef<Expense | undefined>(undefined),
    running = useRef(false),
    stopped = useRef(false),
    failure = useRef(false),
    last = useRef("");
  useEffect(() => {
    stopped.current = false;
    if (guest) return;
    let active = true;
    void pilotRequest(path)
      .then((value) => {
        if (!active) return;
        revision.current = value?.revision ?? 0;
        setSaved(value?.expense);
        last.current = JSON.stringify(value?.expense ?? starting.current);
        try {
          const local = localStorage.getItem(key);
          if (local && local !== last.current) setRecovery(JSON.parse(local));
        } catch {
          /* Invalid device recovery data cannot replace the saved draft. */
        }
        setLoaded(true);
      })
      .catch((e) => setStatus(e.message));
    return () => {
      active = false;
      stopped.current = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [guest, path, key]);
  const flush = useCallback(async () => {
    if (running.current || stopped.current || failure.current || !queue.current)
      return;
    const expense = queue.current;
    queue.current = undefined;
    running.current = true;
    setSaving(true);
    setStatus("Saving private draft…");
    try {
      const result = await pilotRequest(path, {
        method: "POST",
        body: JSON.stringify({
          expense,
          expected: revision.current,
          key: crypto.randomUUID(),
        }),
      });
      revision.current = result.revision;
      last.current = JSON.stringify(expense);
      setStatus("Private draft saved");
    } catch (e) {
      failure.current = true;
      setStatus(
        `${e instanceof Error ? e.message : "Unable to save."} Your entered draft remains on this device.`,
      );
    } finally {
      running.current = false;
      setSaving(false);
    }
  }, [path]);
  const changed = useCallback(
    (expense: Expense) => {
      if (guest || !loaded || stopped.current) return;
      const json = JSON.stringify(expense);
      localStorage.setItem(key, json);
      if (json === last.current) return;
      queue.current = expense;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 700);
    },
    [guest, loaded, key, flush],
  );
  useEffect(() => {
    if (!saving && queue.current && !failure.current && !stopped.current)
      void flush();
  }, [saving, flush]);
  if (!loaded)
    return <p role="status">{status || "Loading your private draft…"}</p>;
  return (
    <div className="space-y-3">
      {status && (
        <p role="status" className="text-xs text-app-muted">
          {status}
        </p>
      )}
      {recovery && (
        <button
          type="button"
          onClick={() => {
            setSaved(recovery);
            setVersion((v) => v + 1);
            setRecovery(undefined);
          }}
          className="min-h-11 text-sm underline"
        >
          Restore the retained draft from this device
        </button>
      )}
      <ExpenseForm
        allowAIDraft={false}
        key={version}
        email={email}
        original={original}
        initial={saved ?? original ?? initial}
        draftStorageKey={guest ? key : undefined}
        onDraftChange={changed}
        busy={busy || saving}
        onSave={async (expense, reason) => {
          if (timer.current) clearTimeout(timer.current);
          await flush();
          if (running.current)
            throw Error("Wait for the private draft to finish saving.");
          await onSave(expense, reason);
          stopped.current = true;
          queue.current = undefined;
          localStorage.removeItem(key);
          if (!guest && revision.current > 0)
            void pilotRequest(`${path}&expected=${revision.current}`, {
              method: "DELETE",
            }).catch(() => {});
        }}
      />
    </div>
  );
}
