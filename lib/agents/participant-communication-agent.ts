import { formatAmount } from "@/lib/domain/money";
import { getModelForAgent } from "@/lib/ai/model-policy";
import type { ParticipantMessage } from "@/lib/agents/agent-types";
import type { Proposal } from "@/lib/domain/proposal-types";

export function createParticipantMessage(proposal: Proposal, participantId: string): ParticipantMessage {
  const participant = proposal.participants.find((item) => item.id === participantId);
  if (!participant) {
    throw new Error("Participant was not found.");
  }

  return {
    model: getModelForAgent("Participant Communication Agent"),
    participantId,
    message: `${proposal.organizerName} sent ${proposal.title}. Your share is ${formatAmount(participant.amountOwed, proposal.currency)} using a ${proposal.splitMethod} split. ${proposal.fairnessExplanation}`,
    actions: ["accept", "request_change", "opt_out"]
  };
}

export function createOrganizerSendPreview(proposal: Proposal): string {
  return `Send ${proposal.title} to ${proposal.participants.length} participant${proposal.participants.length === 1 ? "" : "s"} for review. Total: ${formatAmount(proposal.totalAmount, proposal.currency)}.`;
}
