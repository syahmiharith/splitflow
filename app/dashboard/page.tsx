"use client";

import Link from "next/link";
import { AlertTriangle, Check, ChevronRight, Clock3, FileText, MessageSquareWarning, Users, WalletCards } from "lucide-react";
import { formatKrw, humanStatus } from "@/lib/format";
import { countParticipants } from "@/lib/split";
import { useSplitFlow } from "@/lib/store";
import type { Proposal } from "@/lib/types";
import { AppCard } from "@/components/ui/app-card";

export default function DashboardPage() {
  const { state } = useSplitFlow();
  const proposals = state.proposals.filter((proposal) => proposal.status !== "archived");
  const active = proposals.filter((proposal) => proposal.status !== "settled");
  const totals = proposals.reduce(
    (acc, proposal) => {
      const calculation = proposal.calculationResult;
      const organizerId = proposal.organizerId ?? "you";
      acc.fronted += calculation?.totalPaidByParticipant[organizerId] ?? 0;
      acc.stillOwed += Math.max(0, calculation?.netBalanceByParticipant[organizerId] ?? 0);
      const counts = countParticipants(proposal);
      acc.pending += counts.pending;
      acc.accepted += counts.accepted;
      acc.changes += counts.changes;
      acc.optOuts += counts.optedOut;
      if (proposal.status === "safe_to_book") acc.ready += 1;
      return acc;
    },
    { fronted: 0, stillOwed: 0, pending: 0, accepted: 0, changes: 0, optOuts: 0, ready: 0 }
  );
  const queue = [...active].sort((a, b) => priority(a) - priority(b));

  return (
    <div className="space-y-4 px-4 py-5 md:p-6" data-testid="dashboard-route">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Metric icon={WalletCards} label="Still Owed" value={formatKrw(totals.stillOwed)} tone="blue" />
        <Metric icon={FileText} label="Active Proposals" value={String(active.length)} tone="blue" />
        <Metric icon={Clock3} label="Pending" value={String(totals.pending)} tone="amber" />
        <Metric icon={Check} label="Accepted" value={String(totals.accepted)} tone="green" />
      </div>

      <AppCard className="overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-5">
          <Users className="h-6 w-6 text-app-blue" aria-hidden="true" />
          <h2 className="text-xl font-bold">Live Agreement State</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 md:grid-cols-4">
          <StatusTile label="Requested changes" value={totals.changes} tone="violet" />
          <StatusTile label="Opt-outs" value={totals.optOuts} tone="red" />
          <StatusTile label="Ready to pay" value={totals.ready} tone="green" />
          <StatusTile label="Total fronted" value={formatKrw(totals.fronted)} tone="blue" />
        </div>
      </AppCard>

      <AppCard className="overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-5">
          <AlertTriangle className="h-6 w-6 text-app-amber" aria-hidden="true" />
          <h2 className="text-xl font-bold">Risk & Action Queue</h2>
        </div>
        <div className="divide-y divide-app-border border-t border-app-border">
          {queue.map((proposal) => (
            <Link key={proposal.id} href={`/proposals/${proposal.id}`} className="flex min-h-20 items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${queueTone(proposal)}`}>
                <MessageSquareWarning className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-app-text">{proposal.title}</div>
                <div className="mt-1 text-sm text-app-muted">{nextAction(proposal)}</div>
              </div>
              <span className="hidden rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-app-text sm:inline">{humanStatus(proposal.status)}</span>
              <ChevronRight className="h-5 w-5 shrink-0 text-app-muted" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </AppCard>
    </div>
  );
}

function priority(proposal: Proposal): number {
  if (proposal.status === "changes_requested") return 1;
  if (countParticipants(proposal).optedOut > 0 || proposal.status === "recalculation_needed") return 2;
  if (countParticipants(proposal).pending > 0) return 3;
  if (proposal.status === "safe_to_book") return 4;
  if (proposal.status === "settled") return 5;
  return 6;
}

function nextAction(proposal: Proposal): string {
  const counts = countParticipants(proposal);
  if (proposal.status === "changes_requested") return "Review participant change request.";
  if (proposal.status === "recalculation_needed") return "Recalculate after opt-out before proceeding.";
  if (counts.pending > 0) return `${counts.pending} participant response${counts.pending === 1 ? "" : "s"} pending.`;
  if (proposal.status === "safe_to_book") return "All active participants accepted. Ready to settle.";
  return proposal.recommendation;
}

function queueTone(proposal: Proposal): string {
  if (proposal.status === "changes_requested") return "bg-violet-50 text-app-violet";
  if (proposal.status === "recalculation_needed") return "bg-red-50 text-app-red";
  if (proposal.status === "safe_to_book") return "bg-green-50 text-app-green";
  return "bg-amber-50 text-app-amber";
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof WalletCards; label: string; value: string; tone: "blue" | "amber" | "green" }) {
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

function StatusTile({ label, value, tone }: { label: string; value: number | string; tone: "green" | "violet" | "blue" | "red" }) {
  return (
    <div className={`rounded-xl border p-4 ${tileClass(tone)}`}>
      <div className="text-sm text-app-text">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function tileClass(tone: string) {
  if (tone === "green") return "border-green-200 bg-green-50";
  if (tone === "violet") return "border-violet-200 bg-violet-50";
  if (tone === "red") return "border-red-200 bg-red-50";
  return "border-blue-200 bg-blue-50";
}
