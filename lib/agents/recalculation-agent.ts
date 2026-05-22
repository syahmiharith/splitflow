import type { RecalculationResult } from "@/lib/agents/agent-types";
import { markReconfirmationRequired, withDerivedProposalState } from "@/lib/domain/proposal-state";
import type { Proposal, SplitParticipantInput } from "@/lib/domain/proposal-types";
import { calculateSplit } from "@/lib/domain/split-calculator";

function participantToCalculatorInput(participant: Proposal["participants"][number]): SplitParticipantInput {
  return {
    id: participant.id,
    name: participant.name,
    weight: participant.weight,
    percentage: participant.percentage,
    fixedAmount: participant.fixedAmount,
    metadata: participant.metadata
  };
}

export function runRecalculationAgent(proposal: Proposal, now = new Date().toISOString()): RecalculationResult {
  const active = proposal.participants.filter((participant) => participant.responseStatus !== "opted_out");
  if (active.length < 1) {
    return {
      proposal: withDerivedProposalState({ ...proposal, status: "blocked", updatedAt: now }),
      changedParticipantIds: [],
      auditTrail: [],
      explanation: "Too few participants remain to recalculate the proposal."
    };
  }

  const calculation = calculateSplit({
    totalAmount: proposal.totalAmount,
    currency: proposal.currency,
    method: proposal.splitMethod,
    participants: active.map(participantToCalculatorInput)
  });
  const shareMap = new Map(calculation.shares.map((share) => [share.participantId, share.amount]));
  const auditTrail = proposal.participants.map((participant) => ({
    participantId: participant.id,
    oldAmount: participant.amountOwed,
    newAmount: participant.responseStatus === "opted_out" ? 0 : (shareMap.get(participant.id) ?? participant.amountOwed)
  }));
  const changedParticipantIds = auditTrail
    .filter((entry) => entry.oldAmount !== entry.newAmount && proposal.participants.find((participant) => participant.id === entry.participantId)?.responseStatus !== "opted_out")
    .map((entry) => entry.participantId);

  const recalculated: Proposal = {
    ...proposal,
    calculation,
    participants: proposal.participants.map((participant) => ({
      ...participant,
      previousAmountOwed: participant.amountOwed,
      amountOwed: participant.responseStatus === "opted_out" ? 0 : (shareMap.get(participant.id) ?? participant.amountOwed)
    })),
    status: changedParticipantIds.length > 0 ? "reconfirmation_required" : proposal.status,
    updatedAt: now
  };

  return {
    proposal: changedParticipantIds.length > 0 ? markReconfirmationRequired(recalculated, changedParticipantIds, now) : withDerivedProposalState(recalculated),
    changedParticipantIds,
    auditTrail,
    explanation:
      changedParticipantIds.length > 0
        ? "Remaining participant amounts changed, so reconfirmation is required."
        : "Recalculation completed without changing active participant amounts."
  };
}
