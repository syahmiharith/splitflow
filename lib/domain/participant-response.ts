import type { ParticipantResponseStatus, Proposal } from "@/lib/domain/proposal-types";

export type ParticipantResponseEvent = {
  participantId: string;
  status: Extract<ParticipantResponseStatus, "accepted" | "opted_out" | "requested_change">;
  note?: string;
  createdAt?: string;
};

export function summarizeParticipantResponses(proposal: Proposal) {
  return proposal.participants.reduce(
    (summary, participant) => {
      summary[participant.responseStatus] += 1;
      return summary;
    },
    {
      pending: 0,
      accepted: 0,
      opted_out: 0,
      requested_change: 0,
      reconfirmation_required: 0
    }
  );
}

export function applyParticipantResponse(proposal: Proposal, event: ParticipantResponseEvent): Proposal {
  const participant = proposal.participants.find((item) => item.id === event.participantId);
  if (!participant) {
    throw new Error("Participant was not found.");
  }

  const createdAt = event.createdAt ?? new Date().toISOString();
  const participants = proposal.participants.map((item) => {
    if (item.id !== event.participantId) return item;
    if (item.responseStatus === event.status && item.responseNote === event.note) return item;
    return {
      ...item,
      responseStatus: event.status,
      paymentStatus: event.status === "opted_out" ? ("not_applicable" as const) : item.paymentStatus,
      responseNote: event.note
    };
  });

  const changeRequests =
    event.status === "requested_change"
      ? [
          ...proposal.changeRequests,
          {
            participantId: event.participantId,
            note: event.note ?? "Participant requested a change.",
            createdAt,
            resolved: false
          }
        ]
      : proposal.changeRequests;

  return {
    ...proposal,
    participants,
    changeRequests,
    updatedAt: createdAt
  };
}
