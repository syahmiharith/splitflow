"use client";

import Link from "next/link";
import { ChevronRight, CreditCard, FileText, FlameKindling, Plane, Search, Send } from "lucide-react";
import { formatKrw } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import { AppCard } from "@/components/ui/app-card";

const filters = [
  { label: "Active", icon: null },
  { label: "Draft", icon: FileText },
  { label: "Sent", icon: Send },
  { label: "Paid", icon: CreditCard }
];

const proposals = [
  {
    title: "BBQ Dinner",
    icon: FlameKindling,
    status: "Live",
    statusTone: "green",
    total: 128000,
    participantsLabel: "Participants",
    participants: "8",
    splitMethod: "Mixed item-based",
    footer: "5 accepted     2 pending     1 change",
    progress: 42
  },
  {
    title: "Jeju Trip",
    icon: Plane,
    status: "Draft",
    statusTone: "amber",
    total: 420000,
    participantsLabel: "Participants",
    participants: "5",
    splitMethod: "Equal",
    footer: "Ready for review",
    progress: 0
  },
  {
    title: "Netflix Family",
    icon: NetflixIcon,
    status: "Recurring",
    statusTone: "violet",
    total: 17000,
    participantsLabel: "Members",
    participants: "5",
    splitMethod: "Equal",
    footer: "Next collection in 3 days",
    progress: 0
  }
];

export default function ProposalsPage() {
  const { activeProposal } = useSplitFlow();

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
        {proposals.map((proposal) => {
          const Icon = proposal.icon;
          return (
            <Link key={proposal.title} href="/inbox" className="block rounded-2xl focus:outline-none focus:ring-2 focus:ring-app-blue focus:ring-offset-2">
              <AppCard className="relative p-5">
                <div className="flex gap-3">
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-app-blue sm:h-20 sm:w-20">
                    <Icon className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1 pr-5">
                    <div className="flex items-start gap-3">
                      <h2 className="min-w-0 flex-1 truncate text-xl font-bold sm:text-2xl">{proposal.title}</h2>
                      <span className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold ${badgeClass(proposal.statusTone)}`}>{proposal.status}</span>
                    </div>
                    <div className="mt-4 grid grid-cols-[75px_54px_minmax(0,1fr)] items-center gap-2">
                      <Meta label="Total" value={formatKrw(proposal.total)} />
                      <Meta label={proposal.participantsLabel} value={proposal.participants} />
                      <Meta label="Split method" value={proposal.splitMethod} />
                    </div>
                  </div>
                </div>
                <ChevronRight className="absolute right-4 top-[108px] h-6 w-6 text-app-muted" aria-hidden="true" />
                {proposal.progress > 0 ? (
                  <div className="mt-6 h-2 rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-app-blue" style={{ width: `${proposal.progress}%` }} />
                  </div>
                ) : (
                  <div className="mt-6 border-t border-app-border" />
                )}
                <div className="mt-4 flex flex-wrap gap-x-7 gap-y-2 text-base text-app-muted">
                  {proposal.title === activeProposal.title ? (
                    <>
                      <Dot tone="green" label="5 accepted" />
                      <Dot tone="amber" label="2 pending" />
                      <Dot tone="violet" label="1 change" />
                    </>
                  ) : (
                    <Dot tone={proposal.statusTone} label={proposal.footer} />
                  )}
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

function badgeClass(tone: string) {
  if (tone === "green") return "bg-green-50 text-app-green";
  if (tone === "amber") return "bg-amber-50 text-app-amber";
  if (tone === "violet") return "bg-violet-50 text-app-violet";
  return "bg-blue-50 text-app-blue";
}

function NetflixIcon({ className }: { className?: string }) {
  return <span className={`text-5xl font-black text-red-600 ${className ?? ""}`}>N</span>;
}
