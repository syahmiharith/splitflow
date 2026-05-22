import { calculateSplit } from "@/lib/domain/split-calculator";
import type { Proposal } from "@/lib/domain/proposal-types";

export const airbnbMessage =
  "Split a ₩480,000 Busan Airbnb between 5 people. Amir stays 1 night and everyone else stays 2 nights.";

export const dinnerMessage = "Split a ₩120,000 dinner equally between 4 people.";

export const giftMessage = "Split a ₩300,000 group gift where Aina pays ₩50,000 fixed and the rest split the remaining amount between 3 people.";

export function createAcceptedDinnerProposal(): Proposal {
  const calculation = calculateSplit({
    totalAmount: 120000,
    currency: "KRW",
    method: "equal",
    participants: [
      { id: "p1", name: "Participant 1" },
      { id: "p2", name: "Participant 2" },
      { id: "p3", name: "Participant 3" },
      { id: "p4", name: "Participant 4" }
    ]
  });

  return {
    id: "proposal-dinner",
    title: "Dinner",
    organizerName: "You",
    expenseType: "meal",
    totalAmount: 120000,
    currency: "KRW",
    splitMethod: "equal",
    items: [{ id: "item-1", label: "Dinner", amount: 120000 }],
    participants: calculation.shares.map((share) => ({
      id: share.participantId,
      name: share.name,
      amountOwed: share.amount,
      responseStatus: "accepted",
      paymentStatus: "unpaid"
    })),
    status: "ready_to_pay",
    assumptions: ["Everyone is included equally."],
    requiredConfirmations: [],
    fairnessExplanation: "Equal split across all participants.",
    calculation,
    changeRequests: [],
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    sentAt: "2026-05-23T00:01:00.000Z"
  };
}
