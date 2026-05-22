import { applyParticipantResponse, type ParticipantResponseEvent } from "@/lib/domain/participant-response";
import { withDerivedProposalState } from "@/lib/domain/proposal-state";
import type { Proposal } from "@/lib/domain/proposal-types";

export type ResponseTrackingResult = {
  proposal: Proposal;
  pendingParticipantIds: string[];
  recalculationRequired: boolean;
};

export function runResponseTrackingAgent(proposal: Proposal, event: ParticipantResponseEvent): ResponseTrackingResult {
  const updated = applyParticipantResponse(proposal, event);
  const recalculationRequired = event.status === "opted_out";
  const withStatus = withDerivedProposalState({
    ...updated,
    status: recalculationRequired ? "recalculation_required" : updated.status
  });

  return {
    proposal: withStatus,
    pendingParticipantIds: withStatus.participants
      .filter((participant) => participant.responseStatus === "pending")
      .map((participant) => participant.id),
    recalculationRequired
  };
}
