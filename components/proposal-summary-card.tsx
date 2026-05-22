"use client";

import { Bot, CheckCircle2, ChevronDown, Circle, FileText, Send, Sparkles } from "lucide-react";
import { formatKrw, humanStatus } from "@/lib/format";
import type { Proposal } from "@/lib/types";
import { AppCard } from "@/components/ui/app-card";
import { StatusBadge } from "@/components/ui/status-badge";

type ProposalSummaryCardProps = {
  proposal: Proposal;
  onReview: () => void;
  onAdjust: () => void;
  onSend: () => void;
};

export function ProposalSummaryCard({ proposal, onReview, onAdjust, onSend }: ProposalSummaryCardProps) {
  const agents = [
    ["Intake Agent", "completed"],
    ["Cost Agent", "completed"],
    ["Split Agent", "completed"],
    ["Fairness Agent", "completed"],
    ["Participant Agent", proposal.status === "draft" ? "pending" : "completed"]
  ] as const;

  return (
    <AppCard data-testid="draft-proposal-card" className="overflow-hidden">
      <div className="flex items-center gap-3 border-b border-app-border px-5 py-3 md:py-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-app-blue md:h-auto md:w-auto md:bg-transparent md:text-app-text">
          <FileText className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="min-w-0 flex-1 text-lg font-bold text-app-text md:text-base">Draft Split Proposal</h2>
        <ChevronDown className="h-5 w-5 text-app-muted md:hidden" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-5 divide-x divide-app-border border-b border-app-border">
        <SummaryCell label="Event" value={proposal.title} />
        <SummaryCell label="Total" value={formatKrw(proposal.totalCost)} />
        <SummaryCell label="Participants" value={String(proposal.participants.length)} />
        <SummaryCell label="Split method" value={humanStatus(proposal.splitMethod)} className="md:col-span-1" />
        <div className="min-w-0 px-2 py-3 md:px-5 md:py-2.5">
          <div className="text-xs text-app-muted">Status</div>
          <div className="mt-1">
            <span className="inline-flex rounded-md border border-amber-100 bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-app-amber md:hidden">
              {humanStatus(proposal.status)}
            </span>
            <span className="hidden md:inline-flex">
              <StatusBadge status={proposal.status} label={proposal.status === "draft" ? "Draft" : undefined} />
            </span>
          </div>
        </div>
      </div>

      <div className="border-b border-app-border px-5 py-4 md:py-3">
        <div className="mb-3 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm font-semibold text-app-green">
          Deterministic calculation: {formatKrw(proposal.calculationResult?.totalCost ?? proposal.totalCost)} reconciled across payer balances.
        </div>
        <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2 md:block">
          <div className="text-sm font-medium text-app-muted md:text-xs md:text-app-text">Agents</div>
          <div className="grid grid-cols-5 gap-2 md:mt-2 md:flex md:flex-wrap md:gap-x-6 md:gap-y-2">
          {agents.map(([label, status]) => (
            <span key={label} className="flex min-w-0 flex-col items-center gap-1 text-center text-[10px] leading-tight text-app-muted md:inline-flex md:flex-row md:gap-2 md:text-sm md:text-app-text">
              {status === "completed" ? (
                <CheckCircle2 className="h-7 w-7 shrink-0 fill-app-green text-white md:h-4 md:w-4 md:fill-transparent md:text-app-green" aria-hidden="true" />
              ) : (
                <Circle className="h-7 w-7 shrink-0 fill-amber-50 text-app-amber md:h-4 md:w-4 md:fill-transparent" aria-hidden="true" />
              )}
              <span className="truncate md:inline">{mobileAgentLabel(label)}</span>
            </span>
          ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 px-5 py-2.5 sm:flex-row sm:justify-end">
        <button
          type="button"
          data-testid="review-proposal"
          onClick={onReview}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-app-blue px-4 text-base font-semibold text-white hover:bg-blue-700 md:h-10 md:rounded-md md:text-sm"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Review Proposal
        </button>
        <button
          type="button"
          data-testid="ask-ai-adjust"
          onClick={onAdjust}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-4 text-base font-semibold text-app-text hover:bg-slate-50 md:h-10 md:rounded-md md:text-sm"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Ask AI to Adjust
        </button>
        <button
          type="button"
          data-testid="send-proposal"
          onClick={onSend}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-app-border bg-white px-4 text-base font-semibold text-app-text hover:bg-slate-50 md:h-10 md:rounded-md md:text-sm"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Send Proposal
        </button>
      </div>
    </AppCard>
  );
}

function SummaryCell({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`min-w-0 px-2 py-3 md:px-5 md:py-2.5 ${className}`}>
      <div className="text-xs text-app-muted">{label}</div>
      <div className="mt-1 truncate text-xs font-bold text-app-text md:text-sm">{value}</div>
    </div>
  );
}

export function AssistantAvatar() {
  return (
    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-blue-100 bg-blue-50 text-app-blue md:h-12 md:w-12 md:rounded-lg">
      <Bot className="h-6 w-6 md:h-7 md:w-7" aria-hidden="true" />
    </div>
  );
}

function mobileAgentLabel(label: string) {
  const labels: Record<string, string> = {
    "Intake Agent": "Data Collector",
    "Cost Agent": "Rule Builder",
    "Split Agent": "Calculator",
    "Fairness Agent": "Explainer",
    "Participant Agent": "Reviewer"
  };
  return labels[label] ?? label;
}
