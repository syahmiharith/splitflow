import { summarizeParticipantResponses } from "@/lib/domain/participant-response";
import type { Proposal, ProposalStatus } from "@/lib/domain/proposal-types";

export function deriveProposalState(proposal: Proposal): ProposalStatus {
  const active = proposal.participants.filter((participant) => participant.responseStatus !== "opted_out");
  const summary = summarizeParticipantResponses(proposal);
  const unresolvedChanges = proposal.changeRequests.some((request) => !request.resolved);

  if (active.length === 0) return "blocked";
  if (proposal.status === "recalculation_required") return "recalculation_required";
  if (summary.reconfirmation_required > 0) return "reconfirmation_required";
  if (unresolvedChanges || summary.requested_change > 0) return "change_requested";
  if (summary.pending > 0 && summary.accepted > 0) return "partially_accepted";
  if (summary.pending > 0 && proposal.sentAt) return "sent";
  if (active.every((participant) => participant.responseStatus === "accepted")) return "ready_to_pay";
  return proposal.status;
}

export function withDerivedProposalState(proposal: Proposal): Proposal {
  return {
    ...proposal,
    status: deriveProposalState(proposal)
  };
}

export function markReconfirmationRequired(proposal: Proposal, participantIds: string[], now = new Date().toISOString()): Proposal {
  return withDerivedProposalState({
    ...proposal,
    participants: proposal.participants.map((participant) =>
      participantIds.includes(participant.id) && participant.responseStatus !== "opted_out"
        ? { ...participant, responseStatus: "reconfirmation_required" }
        : participant
    ),
    updatedAt: now
  });
}

export function markProposalSent(proposal: Proposal, now = new Date().toISOString()): Proposal {
  return {
    ...proposal,
    status: "sent",
    sentAt: now,
    participants: proposal.participants.map((participant) => ({
      ...participant,
      responseStatus: participant.responseStatus === "pending" ? "pending" : participant.responseStatus
    })),
    updatedAt: now
  };
}
