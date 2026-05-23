import { countParticipants } from "@/lib/split";
import type { GroupAnalyticsSummary, PaymentRecord, SplitFlowGroup, TimelineEvent } from "@/lib/types";

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

export function deriveGroupAnalytics(group: SplitFlowGroup): GroupAnalyticsSummary {
  return group.proposals.reduce(
    (summary, proposal) => {
      const organizerId = proposal.organizerId ?? "you";
      const netBalance = proposal.calculationResult?.netBalanceByParticipant[organizerId] ?? 0;
      summary.activeProposals += proposal.status !== "settled" && proposal.status !== "archived" ? 1 : 0;
      summary.openChangeRequests += countParticipants(proposal).changes;
      summary.pendingSettlements += proposal.status === "safe_to_book" || proposal.status === "partially_paid" || proposal.status === "settling" ? 1 : 0;
      summary.totalFronted += proposal.calculationResult?.totalPaidByParticipant[organizerId] ?? 0;
      summary.stillOwed += Math.max(0, netBalance);
      summary.pendingResponses += countParticipants(proposal).pending + countParticipants(proposal).needsReconfirmation;
      summary.confirmedPayments += sumPaymentRecords(proposal.paymentRecords, "confirmed");
      summary.claimedUnconfirmedCredits += sumPaymentRecords(proposal.paymentRecords, "claimed");
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
  const recentActivity = groups
    .flatMap((group) =>
      group.proposals.flatMap((proposal) =>
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

  return groups.reduce(
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
      activeGroups: groups.length,
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

function sumPaymentRecords(records: PaymentRecord[] | undefined, status: PaymentRecord["status"]): number {
  return (records ?? []).filter((record) => record.status === status).reduce((sum, record) => sum + record.amount, 0);
}
