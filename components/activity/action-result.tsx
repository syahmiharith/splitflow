"use client";
import { MoneyState } from "./money-state";
import { ArrowRight } from "lucide-react";
import { SpendingPlanCard } from "./spending-plan-card";
import type { Preview } from "@/lib/assistant/model";
import { calculateExpense } from "@/lib/pilot/model";
import { money } from "./expense-card";

/** A readable transaction snapshot. Editing remains an explicit separate action. */
export function ActionResult({
  preview,
  review = false,
  saved = false,
}: {
  preview: Preview;
  review?: boolean;
  saved?: boolean;
}) {
  if (preview.plan) return <SpendingPlanCard {...preview.plan} review={review} detailLines={preview.lines} />;
  const expense = preview.expense;
  const changes = preview.lines.filter(line => {
    const amounts = line.match(/₩[\d,]+/g);
    if (line.includes("→") && amounts && amounts.length >= 2) return amounts[0] !== amounts[1];
    return /^(Remove access:|Add access:)/.test(line);
  });
  const detail = (
    <ul>
      {preview.lines.filter(Boolean).map((line, i) => <li key={i}>{line}</li>)}
    </ul>
  );
  if (preview.transfer) {
    const transfer = preview.transfer;
    const status = transfer.status === "reported" ? "Awaiting recipient confirmation" : transfer.status === "confirmed" ? review && !saved ? "Confirm receipt" : "Receipt confirmed" : review && !saved ? "Dispute receipt" : "Disputed";
    return <div className="sf-chat-card-section">
      <div className="sf-money-card-title"><h3>{preview.title}</h3><span>Repayment</span></div>
      <p className="sf-money-message-amount">{money(transfer.amount)}</p>
      <p className="sf-transfer-parties"><span>{transfer.from}</span><ArrowRight size={16} aria-label="to" /><span>{transfer.to}</span></p>
      <MoneyState tone={transfer.status === "confirmed" ? "positive" : "attention"}>{status}</MoneyState>
      {transfer.claimStatus && transfer.claimStatus !== "agreed" && <p className="sf-result-meta">{transfer.claimStatus === "disputed" ? "Claim disputed · prior agreements retained" : "Expense awaiting agreement"}</p>}
      {transfer.reference && <p className="sf-result-meta">{transfer.reference}</p>}
      {review && !saved && <p className="sf-result-meta">{transfer.status === "confirmed" ? "Confirming receipt reduces the agreed outstanding amount." : "Only a confirmed receipt reduces the outstanding amount."}</p>}
      <details><summary>Details</summary>{detail}</details>
    </div>;
  }
  if (!expense || preview.lines[0] !== "Add expense") {
    // Every consequence remains visible before committing: access changes,
    // recurring dates, old/new shares, credits and receipt status.
    return (
      <div className="sf-chat-card-section">
        <h3>{preview.title}</h3>
        {preview.summary?.amount !== undefined && (
          <p className="sf-money-message-amount">
            {money(preview.summary.amount)}<span>{preview.summary.suffix}</span>
          </p>
        )}
        {review && !saved ? detail : (
          <>
            <p className="sf-result-meta">{preview.summary?.text ?? preview.lines[0]}</p>
            {saved && changes.map((line, i) => <p key={i} className="sf-result-item">{line}</p>)}
            {!preview.summary && preview.lines.filter(line =>
              /Awaiting recipient confirmation| · (confirmed|disputed)$|^Response:|^Starts /.test(line),
            ).map((line, i) => <p key={i}>{line}</p>)}
            <details><summary>View details</summary>{detail}</details>
          </>
        )}
      </div>
    );
  }
  const totals = calculateExpense(expense);
  const shares = expense.participants.map(p => totals.shares[p.email]);
  const equal = shares.every(value => value === shares[0]);
  const payers = expense.participants.filter(p => p.paid > 0);
  return (
    <div className="sf-chat-card-section">
      <div className="sf-money-card-title"><h3>{expense.title}</h3><span>{expense.participants.length} people</span></div>
      <p className="sf-money-message-amount">
        {money(equal ? shares[0] : totals.total)}
        <span>{equal ? " each" : " total"}</span>
      </p>
      <p className="sf-result-meta">
        {equal ? `${money(totals.total)} total · ` : ""}
        {expense.mode === "paid"
          ? `Reported paid by ${payers.map(p => p.name).join(", ")}`
          : "Planned expense"}
      </p>
      <MoneyState tone="attention">{expense.mode === "paid" ? "Awaiting participant agreement" : "Proposed cost"}</MoneyState>
      {review && equal && payers.length <= 1 && (
        <p className="sf-money-message-people">
          {expense.participants.map(p => p.name).join(", ")}
        </p>
      )}
      {review && !saved && (!equal || payers.length > 1) && (
        <dl className="sf-result-people">
          {expense.participants.map(p => (
            <div key={p.email}>
              <dt>{p.name}{p.paid > 0 && <small>Paid {money(p.paid)}</small>}</dt>
              <dd>{money(totals.shares[p.email])}</dd>
            </div>
          ))}
        </dl>
      )}
      {review && !saved && expense.items.filter(item =>
        item.included.length !== expense.participants.length || item.custom || item.units,
      ).map((item, i) => (
        <p className="sf-result-item" key={i}>
          {item.name} · {money(item.amount)} · {item.included.map(email =>
            expense.participants.find(p => p.email === email)?.name ?? email,
          ).join(", ")}
          {item.custom ? " · custom shares" : item.units ? " · by units" : ""}
        </p>
      ))}
      <details>
        <summary>{review ? "See calculation" : "View details"}</summary>
        {detail}
      </details>
    </div>
  );
}
