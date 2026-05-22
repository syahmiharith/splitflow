import type { Participant, ParticipantCounts, Proposal, ProposalStatus, SplitMethod } from "@/lib/types";

export function roundKrw(amount: number): number {
  return Math.round(amount);
}

export function activeParticipants(participants: Participant[]): Participant[] {
  return participants.filter((participant) => participant.status !== "opted_out");
}

export function calculateEqualSplit(totalCost: number, participants: Participant[]): Participant[] {
  const active = activeParticipants(participants);
  if (active.length === 0) return participants;
  const share = roundKrw(totalCost / active.length);
  return participants.map((participant) =>
    participant.status === "opted_out" ? { ...participant, shareAmount: 0 } : { ...participant, shareAmount: share }
  );
}

export function validateCustomSplit(totalCost: number, participants: Participant[]): boolean {
  const customTotal = participants.reduce((sum, participant) => sum + (participant.customAmount ?? 0), 0);
  return customTotal === totalCost;
}

export function calculateCustomSplit(totalCost: number, participants: Participant[]): Participant[] {
  if (!validateCustomSplit(totalCost, participants)) {
    throw new Error("Custom split amounts must equal the proposal total.");
  }

  return participants.map((participant) => ({
    ...participant,
    shareAmount: participant.status === "opted_out" ? 0 : participant.customAmount ?? 0
  }));
}

export function calculateUnitSplit(totalCost: number, participants: Participant[]): Participant[] {
  const active = activeParticipants(participants);
  const totalUnits = active.reduce((sum, participant) => sum + (participant.units ?? 1), 0);
  if (totalUnits <= 0) return participants;

  return participants.map((participant) => {
    if (participant.status === "opted_out") return { ...participant, shareAmount: 0 };
    const units = participant.units ?? 1;
    return { ...participant, shareAmount: roundKrw((totalCost * units) / totalUnits) };
  });
}

export function calculateSplit(totalCost: number, participants: Participant[], method: SplitMethod): Participant[] {
  if (method === "custom") return calculateCustomSplit(totalCost, participants);
  if (method === "unit_based") return calculateUnitSplit(totalCost, participants);
  return calculateEqualSplit(totalCost, participants);
}

export function applyOptOut(proposal: Proposal, participantId: string): Proposal {
  const participants = proposal.participants.map((participant) => {
    if (participant.id === participantId) {
      return {
        ...participant,
        status: "opted_out" as const,
        paymentStatus: "review" as const,
        shareAmount: 0,
        lastRespondedAt: new Date().toISOString()
      };
    }

    if (participant.status === "accepted" || participant.status === "paid") {
      return { ...participant, status: "needs_reconfirmation" as const, paymentStatus: "review" as const };
    }

    return participant;
  });

  return {
    ...proposal,
    participants: calculateSplit(proposal.totalCost, participants, proposal.splitMethod),
    status: "needs_reconfirmation",
    fairnessNote: "A participant opted out, so remaining shares changed and reconfirmation is required.",
    updatedAt: new Date().toISOString()
  };
}

export function countParticipants(proposal: Proposal): ParticipantCounts {
  return proposal.participants.reduce<ParticipantCounts>(
    (counts, participant) => {
      if (participant.status === "accepted" || participant.status === "paid") counts.accepted += 1;
      if (participant.status === "pending" || participant.status === "not_sent") counts.pending += 1;
      if (participant.status === "requested_changes") counts.changes += 1;
      if (participant.status === "paid" || participant.paymentStatus === "paid") counts.paid += 1;
      if (participant.status === "opted_out") counts.optedOut += 1;
      if (participant.status === "needs_reconfirmation") counts.needsReconfirmation += 1;
      return counts;
    },
    { accepted: 0, pending: 0, changes: 0, paid: 0, optedOut: 0, needsReconfirmation: 0 }
  );
}

export function acceptedCommittedAmount(proposal: Proposal): number {
  return proposal.participants
    .filter((participant) => participant.status === "accepted" || participant.status === "paid")
    .reduce((sum, participant) => sum + participant.shareAmount, 0);
}

export function organizerRisk(proposal: Proposal): number {
  return Math.max(0, proposal.totalCost - acceptedCommittedAmount(proposal));
}

export function deriveProposalStatus(proposal: Proposal): ProposalStatus {
  if (proposal.status === "booked" || proposal.status === "settling" || proposal.status === "settled") {
    return proposal.status;
  }

  const active = activeParticipants(proposal.participants);
  const hasPending = active.some((participant) => participant.status === "pending" || participant.status === "not_sent");
  const hasChanges = active.some((participant) => participant.status === "requested_changes");
  const needsReconfirmation = active.some((participant) => participant.status === "needs_reconfirmation");
  const allAccepted = active.length > 0 && active.every((participant) => participant.status === "accepted" || participant.status === "paid");

  if (needsReconfirmation) return "needs_reconfirmation";
  if (hasChanges) return "changes_requested";
  if (hasPending) return "waiting_for_responses";
  if (allAccepted && proposal.cancellationRule.trim()) return "safe_to_book";
  return proposal.status;
}

export function isSafeToBook(proposal: Proposal): boolean {
  return deriveProposalStatus(proposal) === "safe_to_book" && organizerRisk(proposal) === 0;
}
