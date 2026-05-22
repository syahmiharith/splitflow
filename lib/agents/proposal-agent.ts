import type { IntakeResult, SplitPlan } from "@/lib/agents/agent-types";
import type { Proposal, SplitCalculationResult } from "@/lib/domain/proposal-types";

function titleFromIntake(intake: IntakeResult): string {
  if (intake.expenseType === "travel_accommodation") return "Busan Airbnb";
  if (intake.expenseType === "meal") return "Dinner Split";
  if (intake.expenseType === "gift") return "Group Gift";
  if (intake.costItems[0]?.label) return intake.costItems[0].label;
  return "Shared Expense";
}

export function runProposalAgent(input: {
  intake: IntakeResult;
  splitPlan: SplitPlan;
  calculation: SplitCalculationResult;
  now?: string;
}): Proposal {
  const now = input.now ?? new Date().toISOString();
  const title = titleFromIntake(input.intake);

  return {
    id: `proposal-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${input.calculation.totalAmount}`,
    title,
    organizerName: "You",
    expenseType: input.intake.expenseType,
    totalAmount: input.calculation.totalAmount,
    currency: input.calculation.currency,
    splitMethod: input.calculation.method,
    items: input.intake.costItems.map((item, index) => ({
      id: `item-${index + 1}`,
      label: item.label,
      amount: item.amount
    })),
    participants: input.calculation.shares.map((share) => {
      const original = input.intake.participants.find((participant) => participant.id === share.participantId);
      return {
        id: share.participantId,
        name: share.name,
        amountOwed: share.amount,
        responseStatus: "pending" as const,
        paymentStatus: "unpaid" as const,
        weight: share.weight,
        percentage: share.percentage,
        fixedAmount: share.fixedAmount,
        metadata: original?.metadata
      };
    }),
    status: "draft",
    assumptions: input.splitPlan.assumptions,
    requiredConfirmations: ["Participants must accept before the organizer treats this as payment-ready."],
    fairnessExplanation: `${input.splitPlan.reason} ${input.calculation.explanation}`,
    calculation: input.calculation,
    changeRequests: [],
    createdAt: now,
    updatedAt: now
  };
}
