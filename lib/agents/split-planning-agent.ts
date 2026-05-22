import type { IntakeResult, SplitPlan } from "@/lib/agents/agent-types";
import type { SplitMethod } from "@/lib/domain/proposal-types";

function chooseMethod(intake: IntakeResult): SplitMethod {
  if (intake.explicitMethod) return intake.explicitMethod;
  if (intake.participants.some((participant) => participant.percentage !== undefined)) return "percentage";
  if (intake.participants.some((participant) => participant.fixedAmount !== undefined)) return "fixed";
  if (intake.participants.some((participant) => participant.weight !== undefined && participant.weight !== 1)) return "weighted";
  return "equal";
}

function methodReason(method: SplitMethod): string {
  if (method === "weighted") return "Participants have different usage, stay duration, or weights.";
  if (method === "percentage") return "The organizer provided explicit percentages.";
  if (method === "fixed") return "At least one participant has a fixed contribution.";
  return "Everyone appears to share the expense equally.";
}

export function runSplitPlanningAgent(intake: IntakeResult): SplitPlan {
  if (intake.totalAmount === undefined) {
    throw new Error("Cannot plan split without a total amount.");
  }
  if (intake.participants.length === 0) {
    throw new Error("Cannot plan split without participants.");
  }

  const method = chooseMethod(intake);
  return {
    method,
    reason: methodReason(method),
    calculatorInput: {
      totalAmount: intake.totalAmount,
      currency: intake.currency,
      method,
      participants: intake.participants
    },
    assumptions: [
      method === "equal" ? "All listed participants are included equally." : methodReason(method),
      ...intake.constraints
    ]
  };
}
