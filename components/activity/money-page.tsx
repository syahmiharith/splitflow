"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { Activity } from "@/lib/activity/model";
import { balances, calculateExpense } from "@/lib/pilot/model";
import { moneySummary } from "@/lib/activity/money-summary";
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
  );
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
      <nav aria-label="Money views" className="sf-ledger-tabs">
        {["Expenses", "Balances", "Repayments"].map((t) => (
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
                    className="sf-ledger-row"
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
                      <strong>{money(c.total)}</strong>
                      <small
                        className={
                          s.expense.mode === "planned"
                            ? ""
                            : b > 0
                              ? "sf-owe"
                              : b < 0
                                ? "sf-owed"
                                : ""
                        }
                      >
                        {s.expense.mode === "planned"
                          ? `Planned · share ${money(c.shares[email] ?? 0)}`
                          : b > 0
                            ? `You owe ${money(b)}`
                            : b < 0
                              ? `You get ${money(-b)}`
                              : "Settled"}
                      </small>
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
            {people.map((p) => {
              const b = moneySummary(splits, p.email);
              return (
                <div className="sf-ledger-row" key={p.email}>
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
                      <small className="sf-owe">Owes {money(b.owe)}</small>
                    )}
                    {b.owed > 0 && (
                      <small className="sf-owed">
                        Gets back {money(b.owed)}
                      </small>
                    )}
                    {!b.owe && !b.owed && <small>Settled</small>}
                  </span>
                </div>
              );
            })}
            <h2 className="sf-ledger-subheading">Who repays whom</h2>
            {moneySummary(splits, email).obligations.map((t, i) => (
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
                <span className="sf-ledger-amount"><strong>{money(t.amount)}</strong><small className="sf-row-action">{t.from === email ? "Report payment" : "View repayment"}</small></span>
                <ChevronRight className="sf-row-chevron" size={18} aria-hidden="true" />
              </button>
            ))}
            <p className="sf-ledger-footnote">
              Payments stay outstanding until the recipient confirms receipt.
            </p>
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
                  <strong>{money(p.amount)}</strong>
                  <small>
                    {p.status === "reported"
                      ? "Awaiting receipt"
                      : p.status === "confirmed"
                        ? "Confirmed"
                        : "Disputed"}
                  </small>
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
