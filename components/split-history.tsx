"use client";
import { useState } from "react";
import { pilotRequest } from "@/lib/pilot/session";
import { calculateExpense, type Split } from "@/lib/pilot/model";
export function SplitHistory({
  id,
  revision,
}: {
  id: string;
  revision: number;
}) {
  const [rows, setRows] =
    useState<{ revision: number; document: Split; created_at: string }[]>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load() {
    setBusy(true);
    setError("");
    try {
      setRows(await pilotRequest(`/api/pilot/history?split=${id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t load history.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open) void load();
      }}
      key={`${id}:${revision}`}
    >
      <summary className="min-h-11 cursor-pointer text-sm font-semibold">
        Revision history
      </summary>
      {busy && (
        <p role="status" className="text-sm">
          Loading history…
        </p>
      )}
      {error && (
        <div role="alert" className="text-sm">
          {error}
          <button onClick={() => void load()}>Retry history</button>
        </div>
      )}
      <ol className="space-y-4">
        {rows?.map((row) => (
          <li
            key={row.revision}
            className="border-t border-app-border pt-3 text-sm"
          >
            <p className="font-semibold">
              Revision {row.revision} · ₩
              {calculateExpense(row.document.expense).total.toLocaleString()}
            </p>
            <p className="mt-1 text-app-muted">
              {new Date(row.created_at).toLocaleString()} ·{" "}
              {row.document.audit.at(-1)?.action}
            </p>
            <ul className="mt-2 space-y-1">
              {row.document.expense.participants.map((p) => (
                <li key={p.email} className="flex justify-between gap-4">
                  <span>{p.name}</span>
                  <span className="tabular-nums">
                    ₩
                    {calculateExpense(row.document.expense).shares[
                      p.email
                    ].toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </details>
  );
}
