import type { AgentName } from "@/lib/agents/agent-types";
import type { Proposal, RiskAssessment } from "@/lib/domain/proposal-types";

export const AI_MODELS = {
  default: "gpt-5.4-mini",
  cheap: "gpt-5.4-nano",
  advanced: "gpt-5.5"
} as const;

export type AiModelName = (typeof AI_MODELS)[keyof typeof AI_MODELS];
export type AgentModel = AiModelName | null;

export const AGENT_MODEL_ASSIGNMENTS: Record<AgentName, AgentModel> = {
  "Orchestrator Agent": AI_MODELS.default,
  "Intake Agent": AI_MODELS.default,
  "Split Planning Agent": null,
  "Proposal Agent": AI_MODELS.default,
  "Participant Communication Agent": AI_MODELS.cheap,
  "Response Tracking Agent": null,
  "Recalculation Agent": null,
  "Risk Decision Agent": null,
  "Recommendation Agent": AI_MODELS.default
};

export type ModelRoutingContext = {
  proposal?: Proposal;
  risk?: RiskAssessment;
  userMessage?: string;
  hasParticipantResponseConflict?: boolean;
  hasComplexFairnessIssue?: boolean;
};

export function shouldEscalateToAdvancedModel(context: ModelRoutingContext): boolean {
  const unresolvedDispute = context.proposal?.changeRequests.some((request) => !request.resolved) ?? false;
  const highOrBlockedRisk = context.risk?.level === "high" || context.risk?.level === "blocked";
  const asksForTradeoffs = /\b(alternative|alternatives|trade-?offs?|options|compare plans?)\b/i.test(context.userMessage ?? "");

  return Boolean(
    unresolvedDispute ||
      context.hasComplexFairnessIssue ||
      highOrBlockedRisk ||
      context.hasParticipantResponseConflict ||
      asksForTradeoffs
  );
}

export function getModelForAgent(agentName: AgentName, context: ModelRoutingContext = {}): AgentModel {
  if (agentName === "Recommendation Agent" && shouldEscalateToAdvancedModel(context)) {
    return AI_MODELS.advanced;
  }

  return AGENT_MODEL_ASSIGNMENTS[agentName];
}

export function getRequiredModelForAgent(agentName: AgentName, context: ModelRoutingContext = {}): AiModelName {
  const model = getModelForAgent(agentName, context);
  if (!model) {
    throw new Error(`${agentName} is deterministic and must not call an AI model.`);
  }
  return model;
}

export function getDefaultRuntimeModel(): AiModelName {
  return AI_MODELS.default;
}
