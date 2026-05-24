"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Clock3, CreditCard, Users } from "lucide-react";
import { formatKrw, humanStatus } from "@/lib/format";
import { deriveSplitReadiness } from "@/lib/readiness";
import { useSplitFlow } from "@/lib/store";
import type { Proposal } from "@/lib/types";
import { GroupRouteSync } from "@/components/group-route-sync";
import { WorkspaceDetailPanel } from "@/components/workspace-detail-panel";
import { AppCard } from "@/components/ui/app-card";
import { StatusBadge } from "@/components/ui/status-badge";

export default function GroupProposalDetailPage() {
  const params = useParams<{ groupId: string; proposalId: string }>();
  const { activeGroup, openProposalPanel } = useSplitFlow();
  const proposal = activeGroup.proposals.find((item) => item.id === params.proposalId);

  useEffect(() => {
    openProposalPanel(params.proposalId);
  }, [openProposalPanel, params.proposalId]);

  return (
    <div className="h-full min-h-0 overflow-hidden" data-testid="proposal-detail-route">
      <GroupRouteSync groupId={params.groupId} />
      <div className="h-full min-h-0 min-w-0 overflow-y-auto px-4 py-5 md:p-6">
        {proposal ? <ProposalDetailSummary proposal={proposal} /> : <MissingProposal proposalId={params.proposalId} />}
      </div>
      <WorkspaceDetailPanel fallbackProposal={proposal} />
    </div>
  );
}

function ProposalDetailSummary({ proposal }: { proposal: Proposal }) {
  const readiness = deriveSplitReadiness(proposal);
  const total = proposal.calculationResult?.totalCost ?? proposal.totalCost;
  const claimedPayments = proposal.paymentRecords?.filter((record) => record.status === "claimed") ?? [];
  const changeRequests = proposal.participants.filter((participant) => participant.status === "requested_changes" || participant.changeRequestNote);
  const pending = proposal.participants.filter((participant) => participant.status === "pending" || participant.status === "not_sent" || participant.status === "needs_reconfirmation");

  return (
    <div className="space-y-4 pr-0 xl:pr-[440px]" data-testid="proposal-detail-summary">
      <AppCard className="p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={proposal.status} />
              <span className="rounded-md border border-app-border bg-slate-50 px-2 py-1 text-xs font-bold text-app-muted">
                {humanStatus(proposal.splitMethod)}
              </span>
            </div>
            <h1 className="mt-3 break-words text-2xl font-bold tracking-tight text-app-text md:text-3xl">{proposal.title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-app-muted">{proposal.description}</p>
          </div>
          <div className="rounded-lg border border-app-border bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">Deterministic total</div>
            <div className="mt-1 break-words text-2xl font-bold text-app-text">{formatKrw(total)}</div>
            <p className="mt-2 text-sm leading-6 text-app-muted">Final shares and readiness are calculated in typed app logic.</p>
          </div>
        </div>
      </AppCard>

      <AppCard className="p-5" data-testid="proposal-detail-readiness">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-bold text-app-text">
              {readiness.state === "ready" || readiness.state === "settled" ? (
                <CheckCircle2 className="h-4 w-4 text-app-green" aria-hidden="true" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-app-amber" aria-hidden="true" />
              )}
              Settlement readiness
            </div>
            <p className="mt-2 text-sm font-semibold text-app-text">{readiness.label}</p>
            <p className="mt-1 text-sm leading-6 text-app-muted">{readiness.nextAction}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
            <DetailMetric icon={Users} label="Responses" value={`${readiness.responseProgress.confirmed}/${readiness.responseProgress.total}`} />
            <DetailMetric icon={CreditCard} label="Claims" value={String(readiness.claimedPayments)} />
            <DetailMetric icon={Clock3} label="Blockers" value={String(readiness.blockers.length)} />
          </div>
        </div>
        {readiness.blockers.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2" data-testid="proposal-detail-blockers">
            {readiness.blockers.map((blocker) => (
              <span key={blocker} className="max-w-full break-words rounded-md border border-amber-100 bg-amber-50 px-2 py-1 text-xs font-semibold leading-5 text-app-amber">
                {blocker}
              </span>
            ))}
          </div>
        ) : null}
      </AppCard>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <AppCard className="p-5" data-testid="proposal-detail-participants">
          <h2 className="text-lg font-bold text-app-text">Participant breakdown</h2>
          <div className="mt-3 divide-y divide-app-border">
            {proposal.participants.map((participant) => {
              const fairShare = proposal.calculationResult?.fairShareByParticipant?.[participant.id] ?? participant.shareAmount;
              const net = proposal.calculationResult?.netBalanceByParticipant?.[participant.id] ?? 0;
              return (
                <div key={participant.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="break-words text-sm font-bold text-app-text">{participant.name}</div>
                    <div className="mt-1 text-xs font-semibold text-app-muted">{humanStatus(participant.status)}</div>
                    {participant.changeRequestNote ? <p className="mt-1 text-xs leading-5 text-app-amber">{participant.changeRequestNote}</p> : null}
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-sm font-bold text-app-text">{formatKrw(fairShare)}</div>
                    <div className="mt-1 text-xs text-app-muted">Net {formatKrw(net)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </AppCard>

        <div className="space-y-4">
          <StatusList title="Needs organizer attention" empty="No participant is blocking this split." items={[
            ...changeRequests.map((participant) => `${participant.name}: ${participant.changeRequestNote ?? "requested a change"}`),
            ...claimedPayments.map((record) => `${participantName(proposal, record.fromParticipantId)} claimed ${formatKrw(record.amount)}`),
            ...pending.slice(0, 3).map((participant) => `${participant.name}: waiting for confirmation`)
          ]} />
          <StatusList
            title="Cost rules"
            empty="No special item rules on this split."
            items={proposal.costItems.flatMap((item) => (item.excludedParticipantIds ?? []).map((id) => `${participantName(proposal, id)} excluded from ${item.label.toLowerCase()}`))}
          />
        </div>
      </div>
    </div>
  );
}

function DetailMetric({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-app-border bg-white px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-app-muted">
        <Icon className="h-4 w-4 text-app-blue" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-1 break-words text-lg font-bold text-app-text">{value}</div>
    </div>
  );
}

function StatusList({ title, empty, items }: { title: string; empty: string; items: string[] }) {
  const uniqueItems = Array.from(new Set(items)).slice(0, 6);
  return (
    <AppCard className="p-5">
      <h2 className="text-lg font-bold text-app-text">{title}</h2>
      {uniqueItems.length > 0 ? (
        <div className="mt-3 space-y-2">
          {uniqueItems.map((item) => (
            <div key={item} className="rounded-md border border-app-border bg-slate-50 px-3 py-2 text-sm leading-6 text-app-text">
              {item}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-md border border-app-border bg-slate-50 px-3 py-2 text-sm leading-6 text-app-muted">{empty}</p>
      )}
    </AppCard>
  );
}

function MissingProposal({ proposalId }: { proposalId: string }) {
  return (
    <AppCard className="p-5" data-testid="proposal-detail-missing">
      <h1 className="text-xl font-bold text-app-text">Split not found</h1>
      <p className="mt-2 text-sm leading-6 text-app-muted">No proposal with id {proposalId} exists in the selected group.</p>
    </AppCard>
  );
}

function participantName(proposal: Proposal, participantId: string): string {
  return proposal.participants.find((participant) => participant.id === participantId)?.name ?? participantId;
}
