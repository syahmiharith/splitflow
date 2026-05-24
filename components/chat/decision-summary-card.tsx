"use client";

import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { formatKrw } from "@/lib/format";
import type { ReadinessSummary } from "@/lib/readiness";
import type { Proposal } from "@/lib/types";

type DecisionSummaryCardProps = {
  proposal: Proposal;
  summary: ReadinessSummary;
  onReview: () => void;
};

export function DecisionSummaryCard({ proposal, summary, onReview }: DecisionSummaryCardProps) {
  const ready = summary.tone === "green";
  const reasons = decisionReasons(proposal, summary);

  return (
    <section
      data-testid="decision-summary-card"
      className={`rounded-lg border bg-white p-4 shadow-[0_1px_2px_rgba(24,33,47,0.04)] ${ready ? "border-green-200" : "border-amber-200"}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 rounded-md px-2.5 py-1 text-xs font-bold ${ready ? "bg-green-50 text-app-green" : "bg-amber-50 text-app-amber"}`}>
            {ready ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
            {ready ? "Ready" : "Needs review"}
          </div>
          <h2 className="mt-2 text-lg font-bold text-app-text">{decisionTitle(summary)}</h2>
          <p className="mt-1 text-sm leading-6 text-app-muted">{summary.message}</p>
        </div>
        <div className="rounded-md border border-app-border bg-slate-50 px-3 py-2 text-right">
          <div className="text-xs font-semibold text-app-muted">Proposal total</div>
          <div className="mt-1 text-base font-bold text-app-text">{formatKrw(proposal.calculationResult?.totalCost ?? proposal.totalCost)}</div>
        </div>
      </div>

      <ul className="mt-3 space-y-1 text-sm leading-6 text-app-text">
        {reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm font-semibold text-app-text">Next action: {summary.nextAction}</div>
        <button
          type="button"
          data-testid="decision-primary-cta"
          onClick={onReview}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-app-blue px-3 text-sm font-bold text-white hover:bg-blue-700"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          {proposal.status === "draft" ? "Review & send proposal" : "Review details"}
        </button>
      </div>
    </section>
  );
}

function decisionTitle(summary: ReadinessSummary): string {
  if (summary.tone === "green") return "Ready to settle";
  if (/settle/i.test(summary.nextAction) || /payment|claimed|change|confirm/i.test(summary.message)) return "Not ready to settle";
  return "Not ready to book yet";
}

function decisionReasons(proposal: Proposal, summary: ReadinessSummary): string[] {
  const blockers = summary.blockers.slice(0, 3);
  if (blockers.length > 0) return blockers;
  const claimed = proposal.paymentRecords?.filter((record) => record.status === "claimed").length ?? 0;
  const exclusions = proposal.costItems.filter((item) => item.excludedParticipantIds?.length).length;
  return [
    proposal.status === "draft" ? "Proposal has not been sent." : summary.message,
    claimed > 0 ? `${claimed} claimed payment needs confirmation.` : "No claimed payment blocker remains.",
    exclusions > 0 ? `${exclusions} participant exclusion needs review.` : "No participant exclusion blocker remains."
  ];
}
