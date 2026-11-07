"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { calculateExpense, type Split } from "@/lib/pilot/model";
import { nextAction } from "@/lib/pilot/next-action";
import { recoverySummary, splitStage } from "@/lib/pilot/workspace-summary";
const money = (n: number) => `₩${n.toLocaleString("ko-KR")}`;
const filters = [
  { id: "all", name: "All" },
  { id: "needs_action", name: "Needs action" },
  { id: "waiting", name: "Waiting" },
  { id: "ready", name: "Agreed" },
  { id: "settled", name: "Settled" },
] as const;
export function SplitLibrary({
  splits,
  email,
}: {
  splits: Split[];
  email: string;
}) {
  const [filter, setFilter] = useState<string>("all");
  const visible = splits.filter(
    (s) => filter === "all" || splitStage(s, email) === filter,
  );
  const totals = recoverySummary(splits, email);
  return (
    <section className="space-y-6" aria-label="Your shared splits">
      <div className="flex flex-wrap gap-8 border-b border-app-border pb-5">
        {[
          { name: "You owe", value: totals.owe },
          { name: "Owed to you", value: totals.owed },
        ].map((m) => (
          <div key={m.name}>
            <p className="text-sm text-app-muted">{m.name}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {money(m.value)}
            </p>
          </div>
        ))}
      </div>
      <div
        role="group"
        aria-label="Filter splits"
        className="flex flex-wrap gap-2"
      >
        {filters.map((f) => (
          <button
            key={f.id}
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`min-h-11 rounded-lg px-3 text-sm ${filter === f.id ? "bg-slate-100 font-semibold" : "text-app-muted"}`}
          >
            {f.name}{" "}
            <span className="text-app-muted">
              {f.id === "all"
                ? splits.length
                : splits.filter((s) => splitStage(s, email) === f.id).length}
            </span>
          </button>
        ))}
      </div>
      {visible.length ? (
        <div className="divide-y divide-app-border">
          {visible.map((split) => (
            <Link
              key={split.id}
              href={`/?split=${split.id}`}
              className="flex items-center gap-4 py-5"
            >
              <div className="min-w-0 flex-1">
                <h2 className="break-words text-base font-semibold">
                  {split.expense.title}
                </h2>
                <p className="mt-1 text-sm text-app-muted">
                  {nextAction(split, email)}
                </p>
                <p className="mt-2 text-xs text-app-muted">
                  {split.expense.participants.length} people ·{" "}
                  {split.expense.mode === "paid"
                    ? "Already paid"
                    : "Planned expense"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-app-muted">Your share</p>
                <p className="mt-1 text-sm font-semibold tabular-nums">
                  {money(calculateExpense(split.expense).shares[email] ?? 0)}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          ))}
        </div>
      ) : (
        <p className="py-8 text-sm text-app-muted">No splits in this view.</p>
      )}
      <details>
        <summary>Payment overview</summary>
        <dl className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-app-muted">Paid toward expenses</dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {money(totals.paid)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-app-muted">
              Confirmed transfers received
            </dt>
            <dd className="mt-1 font-semibold tabular-nums">
              {money(totals.received)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-app-muted">
          Across your recorded paid expenses. Reported or disputed transfers do
          not reduce outstanding balances. Received transfers may include
          credits after revisions.
        </p>
      </details>
    </section>
  );
}
