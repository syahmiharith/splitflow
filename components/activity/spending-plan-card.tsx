"use client";
import type { SpendingPlan, SpendingPlanSummary } from "@/lib/activity/planning";
import { spendingPlanChanges } from "@/lib/activity/planning";

const rowClass = "flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-app-border py-2";
const money = (value: number) => `₩${value.toLocaleString("en-US")}`;
/** A snapshot of allowances and reported costs, never a balance or payment form. */
export function SpendingPlanCard({
  current,
  previous,
  summary,
  reason,
  classificationChanges = [],
  review = false,
  detailLines = [],
}: {
  current: SpendingPlan;
  previous?: SpendingPlan;
  summary: SpendingPlanSummary;
  reason?: string;
  classificationChanges?: string[];
  review?: boolean;
  detailLines?: string[];
}) {
  const changes = spendingPlanChanges(previous, current);
  const over = summary.remainingAllowance < 0;
  return (
    <div className="sf-chat-card-section">
      <h3>Spending plan</h3>
      {(!review || !previous || previous.limit !== current.limit) && <p className="sf-money-message-amount">{money(current.limit)}<span> allowance limit</span></p>}
      <p className="sf-result-meta">Allowance, not available cash</p>
      {review && previous && previous.limit !== current.limit && (
        <p>Limit: {money(previous.limit)} → {money(current.limit)}</p>
      )}
      <dl className="text-sm">
        {review ? changes.categories.filter(category => !previous || category.before !== category.after || category.removed).map(category => (
          <div key={category.name} className={rowClass}>
            <dt>{category.name}{category.removed && <small className="block text-xs text-app-muted">Removed</small>}</dt>
            <dd className="text-right font-medium tabular-nums">{previous ? `${money(category.before)} → ` : ""}{money(category.after)}</dd>
          </div>
        )) : <>
          <div className={rowClass}><dt>Reported costs</dt><dd className="text-right font-medium tabular-nums">{money(summary.reportedCost)}</dd></div>
          <div className={rowClass}><dt>{over ? "Over plan" : "Remaining allowance"}</dt><dd className={`text-right font-medium tabular-nums ${over ? "text-amber-800" : ""}`}>{money(Math.abs(summary.remainingAllowance))}</dd></div>
        </>}
      </dl>
      {review && classificationChanges.map((change, i) => <p key={i} className="mt-2 break-words text-sm">{change}</p>)}

      <details>
        <summary>Details</summary>
        {reason && <p>{reason}</p>}
        {detailLines.length > 0 && <ul>{detailLines.map((line, i) => <li key={i}>{line}</li>)}</ul>}
        <p>Reported costs are claims, not verified spending. This plan creates no debt or payment.</p>
        <p>Unallocated allowance: {money(summary.unallocatedAllowance)}</p>
        <p>Proposed expenses: {money(summary.plannedCost)}</p>
        <p>Uncategorized reported costs: {money(summary.uncategorizedReportedCost)}</p>
        {!review && <dl className="text-sm">
          {summary.categories.map(category => <div key={category.name} className={rowClass}>
            <dt>{category.name}<small className="block text-xs text-app-muted">Reported {money(category.reportedCost)}</small></dt>
            <dd className="text-right font-medium tabular-nums">{money(category.allowance)}</dd>
          </div>)}
        </dl>}
      </details>
    </div>
  );
}
