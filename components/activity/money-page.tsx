"use client";
import { useState } from "react";
import { MoneyState } from "./money-state";
import { ChevronRight, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { Activity } from "@/lib/activity/model";
import { balances, calculateExpense, claimState } from "@/lib/pilot/model";
import { moneySummaries } from "@/lib/activity/money-summary";
import { summarizeSpendingPlan } from "@/lib/activity/planning";
import { money } from "./expense-card";
import { MoneyStatus } from "./money-overview";

/** Read-only ledger. Mutations always hand off to the original conversation. */
export function MoneyPage({
  title,
  activities,
  email,
  onOpen,
  onManage,
}: {
  title: string;
  activities: Activity[];
  email: string;
  onOpen: (activity: string, expense?: string) => void;
  onManage?: () => void;
}) {
  const [tab, setTab] = useState("Expenses");
  const [query, setQuery] = useState("");
  const entries = activities
    .flatMap((a) => a.expenses.map((s) => ({ activity: a, split: s })))
    .sort((a, b) =>
      (b.split.audit[0]?.at ?? "").localeCompare(a.split.audit[0]?.at ?? ""),
    );
  const splits = entries.map((e) => e.split);
  const people = [
    ...new Map(
      splits.flatMap((s) => s.expense.participants).map((p) => [p.email, p]),
    ).values(),
  ];
  const transfers = entries.flatMap((e) =>
    e.split.repayments.map((payment) => ({ ...e, payment })),
  ).sort((a,b) => Number(a.payment.status === "confirmed") - Number(b.payment.status === "confirmed"));
  return (
    <section className="sf-ledger" aria-label="Money overview">
      <header className="sf-ledger-heading">
        <div>
          <h1>{title}</h1>
        </div>
        {onManage && <button onClick={onManage}>Manage group →</button>}
      </header>
      <div className="sf-ledger-position">
        <MoneyStatus splits={splits} email={email} />
        {activities.length > 1 && <p>Across {activities.length} activities{activities.some(a => a.archivedBy.includes(email)) ? " · includes archived activities" : ""}</p>}
      </div>
      <nav aria-label="Money views" className="sf-ledger-tabs overflow-x-auto whitespace-nowrap">
        {["Expenses", "Balances", "Repayments", "Planning"].map((t) => (
          <button
            key={t}
            aria-current={tab === t ? "page" : undefined}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </nav>
      {tab === "Expenses" && (
        <label className="sf-ledger-search">
          <span className="sr-only">Search expenses</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search expenses or activities"
          />
        </label>
      )}
      <div aria-live="polite">
        {tab === "Expenses" && (
          <>
            {entries.filter((e) =>
              `${e.split.expense.title} ${e.activity.title}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ).length === 0 && (
              <p className="sf-ledger-empty">
                {query ? "No matching expenses." : "No expenses recorded yet."}
              </p>
            )}
            {entries
              .filter((e) =>
                `${e.split.expense.title} ${e.activity.title}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map(({ activity: a, split: s }) => {
                const b = balances(s)[email] ?? 0;
                const c = calculateExpense(s.expense);
                const payers = s.expense.participants.filter((p) => p.paid > 0);
                return (
                  <button
                    className="sf-ledger-row sf-expense-ledger-row"
                    key={s.id}
                    onClick={() => onOpen(a.id, s.id)}
                  >
                    <span className="sf-ledger-date">
                      {s.audit[0]?.at
                        ? new Date(s.audit[0].at).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            timeZone: "Asia/Seoul",
                          })
                        : "—"}
                    </span>
                    <span className="sf-ledger-description">
                      <strong>{s.expense.title}</strong>
                      <small>
                        {a.title} · {payers[0]?.name ?? "Payer not recorded"}
                        {payers.length > 1 ? ` +${payers.length - 1}` : ""}
                        {payers.length
                          ? s.expense.mode === "planned"
                            ? " · planned"
                            : " paid"
                          : ""}
                      </small>
                    </span>
                    <span className="sf-ledger-amount">
                      <small>{s.expense.mode === "planned" ? "Planned share" : claimState(s) === "agreed" ? "Your share" : "Claimed share"}</small>
                      <strong>{money(c.shares[email] ?? 0, s.expense.currency)}</strong>
                      <small>{money(c.total, s.expense.currency)} total</small>
                    </span>
                    <span className="sf-ledger-row-state">
                      <MoneyState tone={claimState(s) === "agreed" ? "positive" : "attention"}>
                        {s.expense.mode === "planned" ? "Proposed cost" : claimState(s) === "disputed" ? "Disputed claim" : claimState(s) !== "agreed" ? "Awaiting agreement" : b > 0 ? `You owe ${money(b, s.expense.currency)}` : b < 0 ? `You get ${money(-b, s.expense.currency)}` : "Settled"}
                      </MoneyState>
                    </span>
                  </button>
                );
              })}
          </>
        )}
        {tab === "Balances" && (
          <>
            {people.length === 0 && (
              <p className="sf-ledger-empty">
                Balances appear when a cost is recorded.
              </p>
            )}
            {people.flatMap((p) => moneySummaries(splits, p.email).map((b) => {
              return (
                <div className="sf-ledger-row" key={`${p.email}:${b.currency}`}>
                  <span className="sf-ledger-avatar" aria-hidden="true">
                    {p.name.slice(0, 1)}
                  </span>
                  <span className="sf-ledger-description">
                    <strong>
                      {p.name}
                      {p.email === email ? " (you)" : ""}
                    </strong>
                  </span>
                  <span className="sf-ledger-amount">
                    {b.owe > 0 && (
                      <strong className="sf-owe">{money(b.owe, b.currency)}<small>Owes</small></strong>
                    )}
                    {b.owed > 0 && (
                      <strong className="sf-owed">{money(b.owed, b.currency)}<small>Gets back</small></strong>
                    )}
                    {!b.owe && !b.owed && <small>{b.pendingClaims || b.disputedClaims ? "No agreed amount outstanding" : "Settled"}</small>}
                    {b.pendingClaims > 0 && <small>{b.pendingClaims} awaiting agreement</small>}
                    {b.disputedClaims > 0 && <small>{b.disputedClaims} disputed</small>}
                  </span>
                </div>
              );
            }))}
            <h2 className="sf-ledger-subheading">Who repays whom</h2>
            {moneySummaries(splits, email).flatMap(s => s.obligations).map((t, i) => (
              <button
                className="sf-ledger-row sf-repayment-link"
                key={i}
                onClick={() =>
                  onOpen(
                    entries.find((e) => e.split.id === t.splitId)!.activity.id,
                    t.splitId,
                  )
                }
              >
                <span className="sf-ledger-description">
                  <strong>
                    {people.find((p) => p.email === t.from)?.name} →{" "}
                    {people.find((p) => p.email === t.to)?.name}
                  </strong>
                  <small>{t.title}</small>
                </span>
                <span className="sf-ledger-amount"><strong>{money(t.amount, t.currency)}</strong><small className="sf-row-action">{t.from === email ? "Report payment" : "View repayment"}</small></span>
                <ChevronRight className="sf-row-chevron" size={18} aria-hidden="true" />
              </button>
            ))}
            <p className="sf-ledger-footnote">
              Payments stay outstanding until the recipient confirms receipt.
            </p>
          </>
        )}
        {tab === "Planning" && (
          <>
            <p className="sf-ledger-footnote">Allowances are plans, not available cash. Reported costs may still need agreement.</p>
            {activities.length === 0 && <p className="sf-ledger-empty">Start an activity in conversation to plan shared costs.</p>}
            {activities.map(activity => {
              const summary = activity.plan ? summarizeSpendingPlan(activity.plan, activity.expenses) : undefined;
              return <div key={activity.id}>
                <button className="sf-ledger-row" onClick={() => onOpen(activity.id)}>
                  <span className="sf-ledger-description">
                    <strong>{activity.title}</strong>
                    <small>{summary ? `Reported costs ${money(summary.reportedCost)}` : "Set a spending limit in conversation"}</small>
                  </span>
                  <span className="sf-ledger-amount">
                    {summary ? <>
                      <strong>{money(summary.limit)} limit</strong>
                      <small className={summary.remainingAllowance < 0 ? "sf-owe" : ""}>
                        {summary.remainingAllowance < 0 ? `${money(-summary.remainingAllowance)} over plan` : `${money(summary.remainingAllowance)} allowance left`}
                      </small>
                    </> : <small>Plan →</small>}
                  </span>
                  <ChevronRight className="sf-row-chevron" size={18} aria-hidden="true" />
                </button>
                {summary && <details className="py-2 text-sm">
                  <summary className="min-h-11 cursor-pointer py-3">Categories and plan details</summary>
                  <dl>
                    {summary.categories.map(category => <div key={category.name} className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-app-border py-2">
                      <dt className="min-w-0 break-words">{category.name}</dt>
                      <dd className="text-right tabular-nums">
                        {money(category.allowance)} allowance
                        <small className="block text-app-muted">{money(category.reportedCost)} reported</small>
                      </dd>
                    </div>)}
                  </dl>
                  <p className="text-app-muted">Unallocated allowance {money(summary.unallocatedAllowance)}</p>
                  <p className="text-app-muted">Uncategorized reported costs {money(summary.uncategorizedReportedCost)}</p>
                  {summary.plannedCost > 0 && <p className="text-app-muted">Proposed expenses {money(summary.plannedCost)}</p>}
                </details>}
              </div>;
            })}
            {activities.some(activity => activity.schedule) && <>
              <h2 className="sf-ledger-subheading">Monthly costs</h2>
              {activities.filter(activity => activity.schedule).map(activity => {
                const schedule = activity.schedule!;
                const total = calculateExpense(schedule.expense).total;
                const accepted = schedule.expense.participants.filter(person => schedule.accepted.includes(person.email)).length;
                return <button key={activity.id} className="sf-ledger-row" onClick={() => onOpen(activity.id)}>
                  <span className="sf-ledger-description">
                    <strong>{schedule.expense.title}</strong>
                    <small>{activity.title} · due day {schedule.dueDay} · from {schedule.start}</small>
                    <small>{schedule.paused ? "Paused" : `${accepted}/${schedule.expense.participants.length} accepted terms`}</small>
                  </span>
                  <span className="sf-ledger-amount"><strong>{money(total, schedule.expense.currency)}</strong><small>{schedule.variable ? "Estimated monthly" : "Monthly terms"}</small></span>
                  <ChevronRight className="sf-row-chevron" size={18} aria-hidden="true" />
                </button>;
              })}
            </>}
            {activities.length > 0 && <p className="sf-ledger-footnote">Open an activity to review or adjust its plan with SplitFlow.</p>}
          </>
        )}
        {tab === "Repayments" && (
          <>
            {!transfers.length && (
              <p className="sf-ledger-empty">
                No repayments reported. Open an expense to report a payment in
                its conversation.
              </p>
            )}
            {transfers.map(({ activity: a, split: s, payment: p }) => (
              <button
                className="sf-ledger-row sf-repayment-link"
                key={p.id}
                onClick={() => onOpen(a.id, s.id)}
              >
                <span className="sf-transfer-avatar" aria-hidden="true">{p.from === email ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}</span>
                <span className="sf-ledger-description">
                  <strong>
                    {
                      s.expense.participants.find((m) => m.email === p.from)
                        ?.name
                    }{" "}
                    →{" "}
                    {s.expense.participants.find((m) => m.email === p.to)?.name}
                  </strong>
                  <small>
                    {s.expense.title}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </small>
                </span>
                <span className="sf-ledger-amount">
                  <strong>{money(p.amount, s.expense.currency)}</strong>
                  <MoneyState tone={p.status === "confirmed" ? "positive" : "attention"}>{p.status === "reported" ? "Awaiting receipt" : p.status === "confirmed" ? "Confirmed" : "Disputed"}</MoneyState>
                  {p.status !== "confirmed" && <small className="sf-row-action">{p.to === email ? p.status === "disputed" ? "Review dispute" : "Review receipt" : "View report"}</small>}
                </span>
                <ChevronRight className="sf-row-chevron" size={18} aria-hidden="true" />
              </button>
            ))}
          </>
        )}
      </div>
      {tab === "Expenses" && entries.length > 0 && <p className="sf-ledger-footnote">Open an expense to review or update it in conversation.</p>}
    </section>
  );
}
