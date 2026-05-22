"use client";

import Link from "next/link";
import { ChevronRight, CreditCard, FileText, FlameKindling, Search, Send } from "lucide-react";
import { formatKrw, humanStatus } from "@/lib/format";
import { countParticipants } from "@/lib/split";
import { useSplitFlow } from "@/lib/store";
import { AppCard } from "@/components/ui/app-card";

const filters = [
  { label: "Active", icon: null },
  { label: "Draft", icon: FileText },
  { label: "Sent", icon: Send },
  { label: "Paid", icon: CreditCard }
];

export default function ProposalsPage() {
  const { state, setActiveProposal } = useSplitFlow();

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="proposals-route">
      <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-app-border bg-white px-4 shadow-[0_1px_2px_rgba(24,33,47,0.04)]">
        <Search className="h-6 w-6 text-app-muted" aria-hidden="true" />
        <input className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-app-muted" placeholder="Search proposals..." />
      </label>

      <div className="flex gap-3 overflow-x-auto pb-1">
        {filters.map((filter, index) => {
          const Icon = filter.icon;
          return (
            <button
              key={filter.label}
              type="button"
              className={`flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 text-base font-semibold ${
                index === 0 ? "border-blue-200 bg-blue-50 text-app-blue" : "border-app-border bg-white text-app-muted"
              }`}
            >
              {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : <span className="h-3 w-3 rounded-full bg-app-blue" aria-hidden="true" />}
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {state.proposals.map((proposal) => {
          const counts = countParticipants(proposal);
          return (
            <Link
              key={proposal.id}
              href={`/proposals/${proposal.id}`}
              onClick={() => setActiveProposal(proposal.id)}
              className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-app-blue focus:ring-offset-2"
            >
              <AppCard className="relative p-5">
                <div className="flex gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-app-blue sm:h-20 sm:w-20">
                    <FlameKindling className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 pr-5">
                    <div className="flex items-start gap-3">
                      <h2 className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl">{proposal.title}</h2>
                      <span className="shrink-0 rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-semibold text-app-blue">{humanStatus(proposal.status)}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-[75px_54px_minmax(0,1fr)] items-center gap-2">
                      <Meta label="Total" value={formatKrw(proposal.totalCost)} />
                      <Meta label="Members" value={String(proposal.participants.length)} />
                      <Meta label="Split method" value={humanStatus(proposal.splitMethod)} />
                    </div>
                  </div>
                </div>
                <ChevronRight className="absolute right-4 top-[108px] h-6 w-6 text-app-muted" aria-hidden="true" />
                <div className="mt-6 h-2 rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-app-blue" style={{ width: `${Math.min(100, (counts.accepted / Math.max(1, proposal.participants.length)) * 100)}%` }} />
                </div>
                <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 text-base text-app-muted">
                  <Dot tone="green" label={`${counts.accepted} accepted`} />
                  <Dot tone="amber" label={`${counts.pending} pending`} />
                  <Dot tone="violet" label={`${counts.changes} change`} />
                </div>
              </AppCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-r border-app-border pr-2 last:border-r-0">
      <div className="truncate text-[11px] text-app-muted sm:text-sm">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold text-app-text sm:text-lg">{value}</div>
    </div>
  );
}

function Dot({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-3">
      <span className={`h-3 w-3 rounded-full ${tone === "green" ? "bg-app-green" : tone === "amber" ? "bg-app-amber" : tone === "violet" ? "bg-app-violet" : "bg-slate-400"}`} />
      {label}
    </span>
  );
}
