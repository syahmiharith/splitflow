import { formatKrw } from "@/lib/format";
import { deriveSplitReadiness } from "@/lib/readiness";
import { countParticipants } from "@/lib/split";
import type { GroupAnalyticsSummary, PaymentRecord, Proposal, SplitFlowGroup, TimelineEvent } from "@/lib/types";

export type GlobalNextAction = {
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  groupId: string;
  proposalId?: string;
  href: string;
  ctaLabel: string;
  reasonTags: string[];
};

export type ActiveWorkflow = {
  groupId: string;
  groupName: string;
  proposalId: string;
  proposalTitle: string;
  totalAmount: number;
  status: Proposal["status"];
  href: string;
  blockers: string[];
  responseProgress: {
    confirmed: number;
    total: number;
    label: string;
  };
  claimedPayments: number;
  nextAction: string;
  readinessLabel: string;
  reasonTags: string[];
};

export type GlobalAnalyticsSummary = {
  activeGroups: number;
  openProposals: number;
  pendingResponses: number;
  unresolvedChangeRequests: number;
  pendingSettlements: number;
  totalFronted: number;
  stillOwed: number;
  confirmedPayments: number;
  claimedUnconfirmedCredits: number;
  recentActivity: Array<{
    groupId: string;
    groupName: string;
    proposalId: string;
    proposalTitle: string;
    event: TimelineEvent;
  }>;
};

export type OperationalAnalytics = {
  totalFronted: number;
  recovered: number;
  stillOwed: number;
  collectionRate: number;
  slowResponseGroups: Array<{ groupId: string; groupName: string; pendingResponses: number }>;
  frequentChangeRequesters: Array<{ participantId: string; participantName: string; count: number }>;
  disputeProneMethods: Array<{ method: Proposal["splitMethod"]; count: number }>;
};

export function deriveGroupAnalytics(group: SplitFlowGroup): GroupAnalyticsSummary {
  return (group.proposals ?? []).reduce(
    (summary, proposal) => {
      const organizerId = proposal.organizerId ?? "you";
      const netBalance = proposal.calculationResult?.netBalanceByParticipant?.[organizerId] ?? 0;
      const counts = countParticipants(proposal);
      summary.activeProposals += proposal.status !== "settled" && proposal.status !== "archived" ? 1 : 0;
      summary.openChangeRequests += counts.changes;
      summary.pendingSettlements += proposal.status === "safe_to_book" || proposal.status === "partially_paid" || proposal.status === "settling" ? 1 : 0;
      summary.totalFronted += proposal.calculationResult?.totalPaidByParticipant?.[organizerId] ?? 0;
      summary.stillOwed += Math.max(0, netBalance);
      summary.pendingResponses += counts.pending + counts.needsReconfirmation;
      summary.confirmedPayments += sumPaymentRecords(proposal.paymentRecords ?? [], "confirmed");
      summary.claimedUnconfirmedCredits += sumPaymentRecords(proposal.paymentRecords ?? [], "claimed");
      return summary;
    },
    {
      activeProposals: 0,
      openChangeRequests: 0,
      pendingSettlements: 0,
      totalFronted: 0,
      stillOwed: 0,
      pendingResponses: 0,
      confirmedPayments: 0,
      claimedUnconfirmedCredits: 0
    } satisfies GroupAnalyticsSummary
  );
}

export function deriveGlobalAnalytics(groups: SplitFlowGroup[]): GlobalAnalyticsSummary {
  const safeGroups = groups ?? [];
  const recentActivity = safeGroups
    .flatMap((group) =>
      (group.proposals ?? []).flatMap((proposal) =>
        (proposal.timeline ?? []).map((event) => ({
          groupId: group.id,
          groupName: group.name,
          proposalId: proposal.id,
          proposalTitle: proposal.title,
          event
        }))
      )
    )
    .sort((a, b) => Date.parse(b.event.at) - Date.parse(a.event.at))
    .slice(0, 5);

  return safeGroups.reduce(
    (summary, group) => {
      const groupSummary = deriveGroupAnalytics(group);
      summary.openProposals += groupSummary.activeProposals;
      summary.pendingResponses += groupSummary.pendingResponses;
      summary.unresolvedChangeRequests += groupSummary.openChangeRequests;
      summary.pendingSettlements += groupSummary.pendingSettlements;
      summary.totalFronted += groupSummary.totalFronted;
      summary.stillOwed += groupSummary.stillOwed;
      summary.confirmedPayments += groupSummary.confirmedPayments;
      summary.claimedUnconfirmedCredits += groupSummary.claimedUnconfirmedCredits;
      return summary;
    },
    {
      activeGroups: safeGroups.length,
      openProposals: 0,
      pendingResponses: 0,
      unresolvedChangeRequests: 0,
      pendingSettlements: 0,
      totalFronted: 0,
      stillOwed: 0,
      confirmedPayments: 0,
      claimedUnconfirmedCredits: 0,
      recentActivity
    } satisfies GlobalAnalyticsSummary
  );
}

export function deriveGlobalNextAction(groups: SplitFlowGroup[]): GlobalNextAction | undefined {
  const safeGroups = groups ?? [];
  if (safeGroups.length === 0) {
    return {
      priority: "low",
      title: "Create a group to start an agreement workflow.",
      description: "SplitFlow needs a recurring group context before it can draft, send, and track shared-cost agreements.",
      groupId: "",
      href: "/groups",
      ctaLabel: "Create group",
      reasonTags: ["No groups"]
    };
  }

  const candidates = safeGroups.flatMap((group) =>
    (group.proposals ?? [])
      .filter((proposal) => proposal.status !== "archived" && proposal.status !== "settled")
      .map((proposal) => ({ group, proposal, readiness: deriveSplitReadiness(proposal) }))
  );

  for (const { group, proposal } of candidates) {
    const participant = proposal.participants.find((item) => item.status === "requested_changes" || Boolean(item.changeRequestNote));
    if (participant) {
      return {
        priority: "high",
        title: `${participant.name} requested a change on ${proposal.title}.`,
        description: participant.changeRequestNote ?? "Review the requested change before settlement.",
        groupId: group.id,
        proposalId: proposal.id,
        href: proposalHref(group.id, proposal.id),
        ctaLabel: "Review split",
        reasonTags: ["Change request", group.name]
      };
    }
  }

  for (const { group, proposal } of candidates) {
    const claim = (proposal.paymentRecords ?? []).find((record) => record.status === "claimed");
    if (claim) {
      const participant = participantName(proposal, claim.fromParticipantId);
      return {
        priority: "high",
        title: `${participant}'s ${formatKrw(claim.amount)} payment claim needs confirmation.`,
        description: `Confirm or dispute the claim on ${proposal.title}; no bank verification is performed in this prototype.`,
        groupId: group.id,
        proposalId: proposal.id,
        href: proposalHref(group.id, proposal.id),
        ctaLabel: "Confirm claim",
        reasonTags: ["Claimed payment", group.name]
      };
    }
  }

  for (const { group, proposal } of candidates) {
    const pending = proposal.participants.filter((participant) => participant.status === "pending" || participant.status === "not_sent");
    const reconfirm = proposal.participants.filter((participant) => participant.status === "needs_reconfirmation");
    if (reconfirm.length > 0) {
      return {
        priority: "medium",
        title: `${reconfirm[0].name} needs to reconfirm ${proposal.title}.`,
        description: "Amounts changed after an earlier response, so the organizer should request fresh confirmation before settlement.",
        groupId: group.id,
        proposalId: proposal.id,
        href: proposalHref(group.id, proposal.id),
        ctaLabel: "Reconfirm split",
        reasonTags: ["Reconfirmation", group.name]
      };
    }
    if (pending.length > 0 && proposal.status !== "draft") {
      return {
        priority: "medium",
        title: `${proposal.title} is waiting for ${pending.length} confirmation${pending.length === 1 ? "" : "s"}.`,
        description: `${pending[0].name} is the next participant to nudge before the organizer can safely proceed.`,
        groupId: group.id,
        proposalId: proposal.id,
        href: proposalHref(group.id, proposal.id),
        ctaLabel: "Review confirmations",
        reasonTags: ["Waiting confirmation", group.name]
      };
    }
  }

  for (const { group, proposal } of candidates) {
    if (proposal.status === "draft") {
      return {
        priority: "medium",
        title: `${proposal.title} is not safe to book yet.`,
        description: "Send the draft split to participants so agreement is explicit before anyone fronts money.",
        groupId: group.id,
        proposalId: proposal.id,
        href: proposalHref(group.id, proposal.id),
        ctaLabel: "Send proposal",
        reasonTags: ["Draft split", group.name]
      };
    }
  }

  for (const { group, proposal, readiness } of candidates) {
    if (readiness.state === "ready") {
      return {
        priority: "low",
        title: `${proposal.title} is ready to settle.`,
        description: "Everyone active has accepted, claimed payments are resolved, and deterministic readiness has no blockers.",
        groupId: group.id,
        proposalId: proposal.id,
        href: proposalHref(group.id, proposal.id),
        ctaLabel: "Settle split",
        reasonTags: ["Ready to settle", group.name]
      };
    }
  }

  const fallbackGroup = safeGroups[0];
  return {
    priority: "low",
    title: "No urgent blockers.",
    description: "Waiting for confirmations or ready-to-settle workflows will appear here as splits move.",
    groupId: fallbackGroup.id,
    href: `/groups/${fallbackGroup.id}`,
    ctaLabel: "Open active group",
    reasonTags: ["No blockers"]
  };
}

export function deriveActiveWorkflows(groups: SplitFlowGroup[], limit = 6): ActiveWorkflow[] {
  return (groups ?? [])
    .flatMap((group) =>
      (group.proposals ?? [])
        .filter((proposal) => proposal.status !== "archived" && proposal.status !== "settled")
        .map((proposal) => {
          const readiness = deriveSplitReadiness(proposal);
          return {
            groupId: group.id,
            groupName: group.name,
            proposalId: proposal.id,
            proposalTitle: proposal.title,
            totalAmount: proposal.calculationResult?.totalCost ?? proposal.totalCost,
            status: proposal.status,
            href: proposalHref(group.id, proposal.id),
            blockers: readiness.blockers.slice(0, 3),
            responseProgress: {
              ...readiness.responseProgress,
              label: `${readiness.responseProgress.confirmed}/${readiness.responseProgress.total} confirmed`
            },
            claimedPayments: readiness.claimedPayments,
            nextAction: readiness.nextAction,
            readinessLabel: readiness.label,
            reasonTags: workflowReasonTags(readiness)
          } satisfies ActiveWorkflow;
        })
    )
    .sort((a, b) => workflowRank(a) - workflowRank(b))
    .slice(0, limit);
}

export function deriveOperationalAnalytics(groups: SplitFlowGroup[]): OperationalAnalytics {
  const summary = deriveGlobalAnalytics(groups);
  const requesterCounts = new Map<string, { participantId: string; participantName: string; count: number }>();
  const methodCounts = new Map<Proposal["splitMethod"], number>();
  const slowResponseGroups = (groups ?? [])
    .map((group) => {
      const pendingResponses = deriveGroupAnalytics(group).pendingResponses;
      return { groupId: group.id, groupName: group.name, pendingResponses };
    })
    .filter((group) => group.pendingResponses > 0)
    .sort((a, b) => b.pendingResponses - a.pendingResponses)
    .slice(0, 3);

  for (const group of groups ?? []) {
    for (const proposal of group.proposals ?? []) {
      const hasChangeRequest = proposal.participants.some((participant) => participant.status === "requested_changes" || Boolean(participant.changeRequestNote));
      if (hasChangeRequest) {
        methodCounts.set(proposal.splitMethod, (methodCounts.get(proposal.splitMethod) ?? 0) + 1);
      }

      for (const participant of proposal.participants) {
        if (participant.status !== "requested_changes" && !participant.changeRequestNote) continue;
        const existing = requesterCounts.get(participant.id) ?? {
          participantId: participant.id,
          participantName: participant.name,
          count: 0
        };
        requesterCounts.set(participant.id, { ...existing, participantName: participant.name, count: existing.count + 1 });
      }
    }
  }

  const totalRecoverable = summary.confirmedPayments + summary.stillOwed;
  const recovered = summary.confirmedPayments;
  const collectionRate = totalRecoverable > 0 ? Math.round((recovered / totalRecoverable) * 100) : 0;

  return {
    totalFronted: summary.totalFronted,
    recovered,
    stillOwed: summary.stillOwed,
    collectionRate,
    slowResponseGroups,
    frequentChangeRequesters: Array.from(requesterCounts.values()).sort((a, b) => b.count - a.count).slice(0, 3),
    disputeProneMethods: Array.from(methodCounts.entries())
      .map(([method, count]) => ({ method, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
  };
}

function sumPaymentRecords(records: PaymentRecord[] | undefined, status: PaymentRecord["status"]): number {
  return (records ?? [])
    .filter((record) => record.status === status)
    .reduce((sum, record) => sum + (Number.isFinite(record.amount) ? record.amount : 0), 0);
}

function participantName(proposal: Proposal, participantId: string): string {
  return proposal.participants.find((participant) => participant.id === participantId)?.name ?? "A participant";
}

function proposalHref(groupId: string, proposalId: string): string {
  return `/groups/${groupId}/proposals/${proposalId}`;
}

function workflowReasonTags(workflow: ReturnType<typeof deriveSplitReadiness>): string[] {
  const tags: string[] = [];
  if (workflow.changeRequests > 0) tags.push("Change request");
  if (workflow.claimedPayments > 0) tags.push("Claimed payment");
  if (workflow.responseProgress.confirmed < workflow.responseProgress.total) tags.push("Waiting confirmation");
  if (workflow.state === "ready") tags.push("Ready to settle");
  return tags.length > 0 ? tags : ["Moving"];
}

function workflowRank(workflow: ActiveWorkflow): number {
  if (workflow.reasonTags.includes("Change request")) return 1;
  if (workflow.reasonTags.includes("Claimed payment")) return 2;
  if (workflow.reasonTags.includes("Waiting confirmation")) return 3;
  if (workflow.status === "draft") return 4;
  if (workflow.reasonTags.includes("Ready to settle")) return 5;
  return 6;
}
