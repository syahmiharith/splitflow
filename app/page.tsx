"use client";

import Link from "next/link";
import { AlertTriangle, Check, FileText, Plus, Users, WalletCards } from "lucide-react";
import { formatKrw } from "@/lib/format";
import { useSplitFlow } from "@/lib/store";
import { AppCard } from "@/components/ui/app-card";

export default function HomePage() {
  const { state, activeGroup } = useSplitFlow();
  const summary = state.groups.reduce(
    (acc, group) => {
      acc.openProposals += group.analyticsSummary.activeProposals;
      acc.changeRequests += group.analyticsSummary.openChangeRequests;
      acc.pendingSettlements += group.analyticsSummary.pendingSettlements;
      acc.stillOwed += group.analyticsSummary.stillOwed;
      return acc;
    },
    { openProposals: 0, changeRequests: 0, pendingSettlements: 0, stillOwed: 0 }
  );
  const recent = state.groups.flatMap((group) => group.proposals.slice(0, 2).map((proposal) => ({ group, proposal }))).slice(0, 5);

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="home-route">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Metric icon={Users} label="Active groups" value={String(state.groups.length)} tone="blue" />
        <Metric icon={FileText} label="Open proposals" value={String(summary.openProposals)} tone="blue" />
        <Metric icon={AlertTriangle} label="Urgent changes" value={String(summary.changeRequests)} tone="amber" />
        <Metric icon={WalletCards} label="Still owed" value={formatKrw(summary.stillOwed)} tone="green" />
      </div>

      <AppCard className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Start with a group workspace</h2>
            <p className="mt-1 text-sm text-app-muted">Chat, proposals, artifacts, and participant responses are scoped to the selected group.</p>
          </div>
          <Link href={`/groups/${activeGroup.id}/chat`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-app-blue px-4 text-sm font-semibold text-white">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Open {activeGroup.name}
          </Link>
        </div>
      </AppCard>

      <AppCard className="overflow-hidden">
        <div className="border-b border-app-border px-5 py-4 text-lg font-bold">Recent activity</div>
        <div className="divide-y divide-app-border">
          {recent.map(({ group, proposal }) => (
            <Link key={`${group.id}-${proposal.id}`} href={`/groups/${group.id}/proposals`} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-blue-50 text-app-blue">
                <Check className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{proposal.title}</div>
                <div className="text-sm text-app-muted">{group.name} · {proposal.status.replaceAll("_", " ")}</div>
              </div>
              <span className="font-semibold">{formatKrw(proposal.totalCost)}</span>
            </Link>
          ))}
        </div>
      </AppCard>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: string; tone: "blue" | "amber" | "green" }) {
  return (
    <div className="min-w-0 rounded-2xl border border-app-border bg-white p-3 shadow-[0_1px_2px_rgba(24,33,47,0.04)] sm:p-4">
      <div className={`mb-3 grid h-10 w-10 place-items-center rounded-full ${tone === "amber" ? "bg-amber-50 text-app-amber" : tone === "green" ? "bg-green-50 text-app-green" : "bg-blue-50 text-app-blue"}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="text-xs leading-tight text-app-muted sm:text-sm">{label}</div>
      <div className="mt-1 whitespace-nowrap text-lg font-bold text-app-text sm:text-xl">{value}</div>
    </div>
  );
}
