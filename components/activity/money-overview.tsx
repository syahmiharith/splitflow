"use client";
import type { Split } from "@/lib/pilot/model";
import type { Person } from "@/lib/activity/model";
import { moneySummary, moneySummaries } from "@/lib/activity/money-summary";
import { formatMoney } from "@/lib/finance/money";
export function MoneyStatus({
  splits,
  email,
}: {
  splits: Split[];
  email: string;
}) {
  const grouped = moneySummaries(splits, email);
  if (grouped.length > 1) return <>{grouped.map(summary => <MoneyStatus key={summary.currency} splits={splits.filter(s => (s.expense.currency ?? "KRW") === summary.currency)} email={email} />)}</>;
  const s = grouped[0];
  const money = (value: number) => formatMoney(value, s.currency);
  return (
    <span className="sf-money-status">
      {s.owe > 0 && <span className="sf-owe">You owe {money(s.owe)}</span>}
      {s.owed > 0 && (
        <span className="sf-owed">You’re owed {money(s.owed)}</span>
      )}
      {!s.owe && !s.owed && (
        <span>
          {s.pendingClaims || s.disputedClaims ? "No agreed amount outstanding" : splits.some((s) => s.expense.mode === "paid") ? "Settled" : "No recorded costs"}
        </span>
      )}
      {s.pendingClaims > 0 && <span>{s.pendingClaims} awaiting agreement</span>}
      {s.disputedClaims > 0 && <span>{s.disputedClaims} disputed</span>}
      {s.planned > 0 && (
        <span className="text-app-muted">Planned share {money(s.planned)}</span>
      )}
    </span>
  );
}
export function MoneyOverview({
  splits,
  email,
  people,
  onOpenExpense,
  group = false,
}: {
  splits: Split[];
  email: string;
  people: Person[];
  group?: boolean;
  onOpenExpense: (id: string) => void;
}) {
  const grouped = moneySummaries(splits, email);
  if (grouped.length > 1) return <>{grouped.map(summary => <MoneyOverview key={summary.currency} splits={splits.filter(s => (s.expense.currency ?? "KRW") === summary.currency)} email={email} people={people} onOpenExpense={onOpenExpense} group={group} />)}</>;
  const s = grouped[0];
  const money = (value: number) => formatMoney(value, s.currency);
  const members = [
    ...new Map(
      [...splits.flatMap((s) => s.expense.participants), ...people].map((p) => [
        p.email,
        p,
      ]),
    ).values(),
  ];
  const name = (id: string) =>
    people.find((p) => p.email === id)?.name ??
    splits.flatMap((s) => s.expense.participants).find((p) => p.email === id)
      ?.name ??
    id;
  return (
    <section
      aria-label={group ? "Group money" : "Activity money"}
      className="sf-money-overview"
    >
      <p className="text-lg font-medium">
        <MoneyStatus splits={splits} email={email} />
      </p>
      {group && (
        <p className="mt-1 text-xs text-app-muted">
          From activities you can access, including archived records.
        </p>
      )}
      <details className="mt-2">
        <summary className="sf-money-disclosure">Balances and people</summary>
        <div className="divide-y">
          {members.map((p) => {
            const b = moneySummary(splits, p.email);
            return (
              <div key={p.email} className="sf-money-person">
                <span>
                  {p.name}
                  {p.email === email ? " (you)" : ""}
                  {!people.some((person) => person.email === p.email) && (
                    <small className="block text-app-muted">
                      Earlier participant
                    </small>
                  )}
                </span>
                <span className="text-right">
                  {b.owe > 0 && (
                    <span className="sf-owe block">Owes {money(b.owe)}</span>
                  )}
                  {b.owed > 0 && (
                    <span className="sf-owed block">
                      Gets back {money(b.owed)}
                    </span>
                  )}
                  {!b.owe && !b.owed && (
                    <span className="text-app-muted">
                      No outstanding balance
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {s.obligations.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium">Who repays whom</h3>
            {s.obligations.map((t, i) => (
              <button
                key={`${t.splitId}:${i}`}
                onClick={() => onOpenExpense(t.splitId)}
                className="sf-obligation"
              >
                <span>
                  {name(t.from)} → {name(t.to)}
                  <small>{t.title}</small>
                </span>
                <span>
                  {money(t.amount)} <span aria-hidden="true">→</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-app-muted">
          Only agreed costs create obligations; confirmed receipts reduce balances. Obligations stay attached to
          their expense.
        </p>
      </details>
      <details>
        <summary className="sf-money-disclosure">Totals</summary>
        <dl className="sf-money-totals">
          <dt>Total claimed costs</dt>
          <dd>{money(s.spent)}</dd>
          <dt>Your share</dt>
          <dd>{money(s.share)}</dd>
          <dt>Your reported payer contributions</dt>
          <dd>{money(s.paid)}</dd>
          <dt>Your planned share</dt>
          <dd>{money(s.planned)}</dd>
        </dl>
      </details>
    </section>
  );
}
