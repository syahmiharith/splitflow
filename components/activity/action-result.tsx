"use client";
import type { Preview } from "@/lib/assistant/model";
import { calculateExpense } from "@/lib/pilot/model";
import { money } from "./expense-card";
/** Read-only snapshot of a tool result, never an independent editor. */
export function ActionResult({
  preview,
  review = false,
}: {
  preview: Preview;
  review?: boolean;
}) {
  if (!preview.expense || preview.lines[0] !== "Add expense")
    return (
      <div className="sf-chat-card-section">
        <h3>{preview.title}</h3>
        <ul>
          {preview.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>
    );
  const expense = preview.expense,
    totals = calculateExpense(expense);
  return (
    <div className="sf-chat-card-section">
      <div className="sf-result-total">
        <h3>{expense.title}</h3>
        <strong>{money(totals.total)}</strong>
      </div>
      <p className="sf-result-meta">
        {expense.mode === "paid" ? "Already paid" : "Planned expense"} ·{" "}
        {expense.participants.length} people
      </p>
      <dl className="sf-result-people">
        {expense.participants.map((person) => (
          <div key={person.email}>
            <dt>
              {person.name}
              {person.paid > 0 && <small>Paid {money(person.paid)}</small>}
            </dt>
            <dd>{money(totals.shares[person.email])}</dd>
          </div>
        ))}
      </dl>
      {review &&
        expense.items.map((item, i) => (
          <p className="sf-result-item" key={i}>
            {item.name} · {money(item.amount)} ·{" "}
            {item.included
              .map(
                (email) =>
                  expense.participants.find((p) => p.email === email)?.name ??
                  email,
              )
              .join(", ")}
            {item.custom ? " · custom shares" : item.units ? " · by units" : ""}
          </p>
        ))}
      <details open={review && preview.lines[0] !== "Add expense"}>
        <summary>Calculation and action details</summary>
        <ul>
          {preview.lines.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
