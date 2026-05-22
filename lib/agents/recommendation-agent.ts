import type { RecommendationResult, RecommendationRoutingContext, RecalculationResult } from "@/lib/agents/agent-types";
import { getRequiredModelForAgent } from "@/lib/ai/model-policy";
import type { Proposal, RiskAssessment } from "@/lib/domain/proposal-types";

export function runRecommendationAgent(input: {
  proposal: Proposal;
  risk: RiskAssessment;
  recalculation?: RecalculationResult;
  routing?: RecommendationRoutingContext;
}): RecommendationResult {
  const hasChangeRequest = input.proposal.changeRequests.some((request) => !request.resolved);
  const model = getRequiredModelForAgent("Recommendation Agent", {
    proposal: input.proposal,
    risk: input.risk,
    ...input.routing
  });

  if (input.risk.level === "blocked" && hasChangeRequest) {
    return {
      model,
      primaryAction: "resolve_change_request",
      confidence: "high",
      recommendation: "Resolve the participant change request before payment or booking.",
      reason: "Unresolved change requests block payment readiness.",
      alternatives: ["Edit the proposal and resend it.", "Discuss the request with the participant before recalculating."]
    };
  }

  if (input.risk.level === "blocked" && input.proposal.participants.some((participant) => participant.responseStatus === "reconfirmation_required")) {
    return {
      model,
      primaryAction: "request_reconfirmation",
      confidence: "high",
      recommendation: "Ask affected participants to reconfirm their updated amounts.",
      reason: "Recalculation changed one or more participant obligations.",
      alternatives: ["Undo the participant change.", "Create a new proposal version."]
    };
  }

  if (input.risk.level === "blocked") {
    return {
      model,
      primaryAction: "do_not_pay",
      confidence: "high",
      recommendation: "Do not pay or book yet.",
      reason: input.risk.reasons[0] ?? "The proposal is blocked.",
      alternatives: ["Collect acceptances first.", "Reduce scope and recalculate."]
    };
  }

  if (input.risk.pendingParticipantIds.length > 0) {
    return {
      model,
      primaryAction: "send_reminder",
      confidence: input.risk.level === "high" ? "high" : "medium",
      recommendation: "Wait before booking and send a reminder to pending participants.",
      reason: `${input.risk.pendingParticipantIds.length} participant${input.risk.pendingParticipantIds.length === 1 ? " has" : "s have"} not accepted yet.`,
      alternatives: ["Proceed only if the organizer is comfortable covering unpaid shares.", "Remove pending participants and recalculate the proposal."],
      suggestedMessage: `Please confirm your share for ${input.proposal.title} so we can decide whether to proceed.`
    };
  }

  return {
    model,
    primaryAction: "proceed_to_pay",
    confidence: "high",
    recommendation: "Proceed to payment or booking review.",
    reason: "All active participants accepted and deterministic risk is low.",
    alternatives: ["Export the proposal summary before paying.", "Wait if the organizer wants extra confirmation."]
  };
}
