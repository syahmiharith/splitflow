import type { Participant } from "@/lib/types";

export function createGroupParticipant(name: string, index: number, options: { isCurrentUser?: boolean } = {}): Participant {
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `member-${index + 1}`;
  const isCurrentUser = options.isCurrentUser === true;

  return {
    id: isCurrentUser ? "you" : id,
    name,
    status: isCurrentUser ? "accepted" : "not_sent",
    shareAmount: 0,
    paymentStatus: isCurrentUser ? "review" : "remind"
  };
}
