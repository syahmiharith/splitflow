"use client";

import { AlertTriangle, CheckCircle2, Clock3, FileText, Search } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { formatKrw, humanStatus } from "@/lib/format";
import { filterProposals, matchesProposalFilter, type ProposalFilter } from "@/lib/proposal-filters";
import { deriveSplitReadiness, type SplitReadiness } from "@/lib/readiness";
import { useSplitFlow } from "@/lib/store";
import { useDeviceProfile } from "@/lib/use-device-profile";
import type { Proposal } from "@/lib/types";
import { GroupRouteSync } from "@/components/group-route-sync";
import { WorkspaceDetailPanel } from "@/components/workspace-detail-panel";
import { AppCard } from "@/components/ui/app-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table } from "@/components/ui/table";

const filters: Array<{ label: string; value: ProposalFilter }> = [
  { label: "Needs action", value: "needs_action" },
  { label: "Drafts", value: "drafts" },
  { label: "Waiting responses", value: "waiting_responses" },
  { label: "Changes requested", value: "changes_requested" },
  { label: "Ready to settle", value: "ready_to_settle" },
  { label: "Settled", value: "settled" },
  { label: "All", value: "all" }
];

export default function GroupProposalsPage() {
  const params = useParams<{ groupId: string }>();
  const { activeGroup, openProposalPanel } = useSplitFlow();
  const device = useDeviceProfile();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProposalFilter>("needs_action");
  const visibleProposals = filterProposals(activeGroup.proposals, filter, query);
  const summary = deriveSplitSummary(activeGroup.proposals);
  const nextBestAction = deriveNextBestAction(activeGroup.proposals);
  const desktopLayout = device.layoutMode === "desktop";

  return (
    <div className="h-full min-h-0 overflow-hidden" data-testid="group-proposals-route">
      <GroupRouteSync groupId={params.groupId} />
      <section className="h-full min-h-0 min-w-0 space-y-4 overflow-y-auto px-4 py-5 md:p-6" data-testid="split-list-scroll">
        <header className="space-y-3" data-testid="splits-summary-header">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-app-text md:text-3xl">Splits</h1>
            <p className="mt-1 text-sm leading-6 text-app-muted">
              {summary.activeSplits} active splits · {summary.needsAction} needs action · {formatKrw(summary.totalPendingAmount)} pending agreement
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
            <SummaryMetric label="Active splits" value={String(summary.activeSplits)} />
            <SummaryMetric label="Needs action" value={String(summary.needsAction)} tone={summary.needsAction > 0 ? "amber" : "green"} />
            <SummaryMetric label="Waiting responses" value={String(summary.waitingResponses)} />
            <SummaryMetric label="Ready to settle" value={String(summary.readyToSettle)} tone="green" />
            <SummaryMetric label="Pending amount" value={formatKrw(summary.totalPendingAmount)} className="col-span-2 lg:col-span-1" />
          </div>
        </header>

        {nextBestAction ? (
          <AppCard className="p-4" data-testid="next-best-action-card">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-app-amber">
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                  Next best action
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-app-text">{nextBestAction.message}</p>
              </div>
              <button
                type="button"
                data-testid="next-best-action-review"
                onClick={() => openProposalPanel(nextBestAction.proposalId)}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-app-blue px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Review split
              </button>
            </div>
          </AppCard>
        ) : (
          <AppCard className="p-4" data-testid="next-best-action-card">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-app-green" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-app-text">No blockers right now.</p>
                <p className="mt-1 text-sm leading-6 text-app-muted">Waiting for participants to confirm or for settled splits to be archived.</p>
              </div>
            </div>
          </AppCard>
        )}

        <div className="flex gap-3 overflow-x-auto pb-1">
          {filters.map((item) => (
            <button
              key={item.value}
              type="button"
              data-testid={`proposal-filter-${item.value}`}
              onClick={() => setFilter(item.value)}
              className={`flex min-h-12 shrink-0 items-center gap-2 rounded-2xl border px-4 text-base font-semibold ${
                filter === item.value ? "border-blue-200 bg-blue-50 text-app-blue" : "border-app-border bg-white text-app-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="flex min-h-12 items-center gap-3 rounded-lg border border-app-border bg-white px-4 shadow-[0_1px_2px_rgba(24,33,47,0.04)]">
          <Search className="h-5 w-5 text-app-muted" aria-hidden="true" />
          <input
            data-testid="proposal-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-app-muted"
            placeholder={`Search ${activeGroup.name} splits...`}
          />
        </label>

        {visibleProposals.length === 0 ? (
          <AppCard className="p-5 text-sm leading-6 text-app-muted" data-testid="proposal-empty-state">
            {emptyStateText(filter, activeGroup.proposals.length)}
          </AppCard>
        ) : null}

        {visibleProposals.length > 0 ? (
          desktopLayout ? (
            <SplitTable proposals={visibleProposals} onOpen={openProposalPanel} />
          ) : (
            <div className="space-y-3" data-testid="split-card-list">
              {visibleProposals.map((proposal) => (
                <SplitCard key={proposal.id} proposal={proposal} onOpen={() => openProposalPanel(proposal.id)} />
              ))}
            </div>
          )
        ) : null}
      </section>
      <WorkspaceDetailPanel desktopPersistent />
    </div>
  );
}

function SplitTable({ proposals, onOpen }: { proposals: Proposal[]; onOpen: (proposalId: string) => void }) {
  return (
    <div data-testid="split-card-list">
      <Table minWidth="940px" data-testid="split-table">
        <Table.Header>
          <Table.Row>
            <Table.Head>Split</Table.Head>
            <Table.Head>Status</Table.Head>
            <Table.Head numeric>Total</Table.Head>
            <Table.Head>Responses</Table.Head>
            <Table.Head>Blockers</Table.Head>
            <Table.Head>Readiness</Table.Head>
            <Table.Head align="right">Action</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body interactive>
          {proposals.map((proposal) => {
            const readiness = deriveSplitReadiness(proposal);
            const exceptions = exceptionChips(proposal);
            const blockers = readiness.blockers.slice(0, 2);
            return (
              <Table.Row
                key={proposal.id}
                data-testid={`proposal-row-${proposal.id}`}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(proposal.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(proposal.id);
                  }
                }}
                className="cursor-pointer"
              >
                <Table.Cell>
                  <div className="min-w-0">
                    <div className="break-words font-bold text-app-text">{proposal.title}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {exceptions.slice(0, 2).map((exception) => (
                        <Chip key={exception} tone="slate" label={exception} />
                      ))}
                    </div>
                  </div>
                </Table.Cell>
                <Table.Cell nowrap>
                  <StatusBadge status={proposal.status} />
                </Table.Cell>
                <Table.Cell numeric nowrap>{formatKrw(proposal.calculationResult?.totalCost ?? proposal.totalCost)}</Table.Cell>
                <Table.Cell nowrap>{`${readiness.responseProgress.confirmed}/${readiness.responseProgress.total} confirmed`}</Table.Cell>
                <Table.Cell>
                  <div className="flex max-w-[260px] flex-wrap gap-1.5">
                    {blockers.length > 0 ? blockers.map((blocker) => <Chip key={blocker} tone="amber" label={blocker} />) : <Chip tone="green" label="No blockers" />}
                    {readiness.changeRequests > 0 ? <Chip tone="red" label={`${readiness.changeRequests} change request${readiness.changeRequests === 1 ? "" : "s"}`} /> : null}
                    {readiness.claimedPayments > 0 ? <Chip tone="amber" label={`${readiness.claimedPayments} claimed payment${readiness.claimedPayments === 1 ? "" : "s"}`} /> : null}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <div className="max-w-[220px]">
                    <div className="text-sm font-bold text-app-text">{readiness.label}</div>
                    <div className="mt-1 break-words text-xs font-semibold text-app-blue">{readiness.nextAction}</div>
                  </div>
                </Table.Cell>
                <Table.Cell align="right" nowrap>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(proposal.id);
                    }}
                    className="inline-flex min-h-9 items-center justify-center rounded-md border border-app-border px-3 text-sm font-semibold text-app-blue hover:bg-slate-50"
                  >
                    Review
                  </button>
                </Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table>
    </div>
  );
}

function SplitCard({ proposal, onOpen }: { proposal: Proposal; onOpen: () => void }) {
  const readiness = deriveSplitReadiness(proposal);
  const exceptions = exceptionChips(proposal);
  const primaryBlockers = readiness.blockers.slice(0, 3);

  return (
    <button
      type="button"
      data-testid={`proposal-row-${proposal.id}`}
      onClick={onOpen}
      className="block w-full rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-app-blue focus:ring-offset-2 md:rounded-lg"
    >
      <AppCard className="p-4 transition hover:border-blue-200 hover:bg-blue-50/30">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 shrink-0 text-app-blue" aria-hidden="true" />
                  <h2 className="min-w-0 break-words text-lg font-bold text-app-text">{proposal.title}</h2>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <StatusBadge status={proposal.status} />
                  <ReadinessBadge readiness={readiness} />
                </div>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">Total</div>
                <div className="mt-1 text-xl font-bold text-app-text">{formatKrw(proposal.calculationResult?.totalCost ?? proposal.totalCost)}</div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <Meta label="Participants" value={String(proposal.participants.length)} />
              <Meta label="Responses" value={`${readiness.responseProgress.confirmed}/${readiness.responseProgress.total} confirmed`} />
              <Meta label="Method" value={humanStatus(proposal.splitMethod)} />
            </div>

            <div className="flex flex-wrap gap-2" data-testid={`split-blockers-${proposal.id}`}>
              {primaryBlockers.length > 0 ? (
                primaryBlockers.map((blocker) => <Chip key={blocker} tone="amber" label={blocker} />)
              ) : (
                <Chip tone="green" label="No blockers" />
              )}
              {readiness.changeRequests > 0 ? <Chip tone="red" label={`${readiness.changeRequests} change request${readiness.changeRequests === 1 ? "" : "s"}`} /> : null}
              {readiness.claimedPayments > 0 ? <Chip tone="amber" label={`${readiness.claimedPayments} claimed payment${readiness.claimedPayments === 1 ? "" : "s"}`} /> : null}
            </div>

            {exceptions.length > 0 ? (
              <div className="flex flex-wrap gap-2" data-testid={`split-rules-${proposal.id}`}>
                {exceptions.map((exception) => <Chip key={exception} tone="slate" label={exception} />)}
              </div>
            ) : null}
          </div>

          <div className="flex min-h-24 flex-col justify-between rounded-lg bg-slate-50 p-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-app-muted">Settlement readiness</div>
              <div className="mt-1 text-sm font-bold text-app-text">{readiness.label}</div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-app-border pt-3">
              <span className="min-w-0 text-sm font-semibold text-app-blue">{readiness.nextAction}</span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-app-blue">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </AppCard>
    </button>
  );
}

function SummaryMetric({ label, value, tone = "blue", className = "" }: { label: string; value: string; tone?: "blue" | "green" | "amber"; className?: string }) {
  const toneClass = tone === "green" ? "text-app-green" : tone === "amber" ? "text-app-amber" : "text-app-blue";
  return (
    <div className={`min-w-0 rounded-lg border border-app-border bg-white px-3 py-3 ${className}`}>
      <div className="truncate text-xs font-semibold text-app-muted">{label}</div>
      <div className={`mt-1 break-words text-lg font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l border-app-border pl-3">
      <div className="truncate text-xs text-app-muted">{label}</div>
      <div className="mt-1 whitespace-nowrap text-sm font-semibold text-app-text">{value}</div>
    </div>
  );
}

function Chip({ label, tone }: { label: string; tone: "amber" | "red" | "green" | "slate" }) {
  const className =
    tone === "amber"
      ? "border-amber-100 bg-amber-50 text-app-amber"
      : tone === "red"
        ? "border-red-100 bg-red-50 text-app-red"
        : tone === "green"
          ? "border-green-100 bg-green-50 text-app-green"
          : "border-slate-200 bg-slate-50 text-app-muted";
  return (
    <span className={`max-w-full break-words rounded-md border px-2 py-1 text-xs font-semibold leading-5 ${className}`}>
      {label}
    </span>
  );
}

function ReadinessBadge({ readiness }: { readiness: SplitReadiness }) {
  const tone = readiness.state === "ready" || readiness.state === "settled" ? "green" : readiness.state === "needs_review" ? "amber" : "slate";
  return <Chip tone={tone} label={readiness.label} />;
}

function deriveSplitSummary(proposals: Proposal[]) {
  const visible = proposals.filter((proposal) => proposal.status !== "archived");
  const active = visible.filter((proposal) => proposal.status !== "settled");
  return {
    activeSplits: active.length,
    needsAction: visible.filter((proposal) => matchesProposalFilter(proposal, "needs_action")).length,
    waitingResponses: visible.reduce((sum, proposal) => {
      const readiness = deriveSplitReadiness(proposal);
      return sum + Math.max(0, readiness.responseProgress.total - readiness.responseProgress.confirmed);
    }, 0),
    readyToSettle: visible.filter((proposal) => deriveSplitReadiness(proposal).state === "ready").length,
    totalPendingAmount: active.reduce((sum, proposal) => sum + (proposal.calculationResult?.totalCost ?? proposal.totalCost), 0)
  };
}

function deriveNextBestAction(proposals: Proposal[]): { proposalId: string; message: string } | undefined {
  const visible = proposals.filter((proposal) => proposal.status !== "archived" && proposal.status !== "settled");
  const claimed = visible
    .map((proposal) => ({ proposal, record: (proposal.paymentRecords ?? []).find((record) => record.status === "claimed") }))
    .find((item) => item.record);
  if (claimed?.record) {
    const participant = claimed.proposal.participants.find((item) => item.id === claimed.record?.fromParticipantId)?.name ?? "A participant";
    return {
      proposalId: claimed.proposal.id,
      message: `${participant}'s ${formatKrw(claimed.record.amount)} payment claim needs organizer confirmation on ${claimed.proposal.title}.`
    };
  }

  for (const proposal of visible) {
    const readiness = deriveSplitReadiness(proposal);
    if (readiness.changeRequests > 0) {
      return { proposalId: proposal.id, message: `${proposal.title} has a requested change. Review before settlement.` };
    }
    if (proposal.status === "draft") {
      return { proposalId: proposal.id, message: `${proposal.title} is not safe to book yet. Send the split to participants first.` };
    }
    if (readiness.blockers.length > 0) {
      return { proposalId: proposal.id, message: `${proposal.title}: ${readiness.blockers[0]}` };
    }
    if (readiness.state === "ready") {
      return { proposalId: proposal.id, message: `${proposal.title} is ready to settle.` };
    }
  }

  return undefined;
}

function exceptionChips(proposal: Proposal): string[] {
  const chips: string[] = [];
  const participantsById = new Map(proposal.participants.map((participant) => [participant.id, participant.name]));

  for (const item of proposal.costItems) {
    for (const participantId of item.excludedParticipantIds ?? []) {
      chips.push(`${participantsById.get(participantId) ?? participantId} excluded from ${item.label.toLowerCase()}`);
    }
  }

  for (const record of proposal.paymentRecords ?? []) {
    if (record.status === "claimed") {
      chips.push(`${participantsById.get(record.fromParticipantId) ?? record.fromParticipantId} claimed ${formatKrw(record.amount)}`);
    }
  }

  for (const participant of proposal.participants) {
    if (participant.roleNote && chips.length < 4) chips.push(shortRule(participant.roleNote));
  }

  return Array.from(new Set(chips)).slice(0, 4);
}

function shortRule(value: string): string {
  return value.replace(/^Risk note:\s*/i, "").replace(/\.$/, "");
}

function emptyStateText(filter: ProposalFilter, totalProposals: number): string {
  if (totalProposals === 0) {
    return "Create a split from Chat. SplitFlow will turn your group-expense prompt into a reviewable agreement.";
  }
  if (filter === "needs_action") {
    return "No blockers right now. Waiting for participants to confirm.";
  }
  if (filter === "settled") {
    return "Settled splits will appear here after all payment claims and confirmations are resolved.";
  }
  return "No splits match this view.";
}
