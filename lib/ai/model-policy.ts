import type { AgentName } from "@/lib/agents/agent-types";
import type { Proposal, RiskAssessment } from "@/lib/domain/proposal-types";

export const AI_MODELS = {
  default: "gpt-5.4-mini",
  cheap: "gpt-5.4-nano",
  advanced: "gpt-5.5"
} as const;

export type AiModelTier = keyof typeof AI_MODELS;
export type AiModelName = string;
export type AgentModel = AiModelName | null;

const AGENT_MODEL_ASSIGNMENTS: Record<AgentName, AiModelTier | null> = {
  "Orchestrator Agent": "default",
  "Intake Agent": "default",
  "Split Planning Agent": null,
  "Proposal Agent": "default",
  "Participant Communication Agent": "cheap",
  "Response Tracking Agent": null,
  "Recalculation Agent": null,
  "Risk Decision Agent": null,
  "Recommendation Agent": "default"
};

export type ModelRoutingContext = {
  proposal?: Proposal;
  risk?: RiskAssessment;
  userMessage?: string;
  hasParticipantResponseConflict?: boolean;
  hasComplexFairnessIssue?: boolean;
};

export type SplitAgentModelRoutingInput = {
  message: string;
  context?: {
    activeProposalTitle?: string;
    participantNames?: string[];
    totalCost?: number;
    proposalStatus?: string;
  };
};

const ENV_BY_TIER: Record<AiModelTier, string> = {
  cheap: "OPENAI_MODEL_CHEAP",
  default: "OPENAI_MODEL_DEFAULT",
  advanced: "OPENAI_MODEL_ADVANCED"
};

export function getConfiguredModel(tier: AiModelTier): AiModelName {
  const tierModel = process.env[ENV_BY_TIER[tier]]?.trim();
  if (tierModel) return tierModel;

  const legacyDefault = tier === "default" ? process.env.OPENAI_MODEL?.trim() : undefined;
  return legacyDefault || AI_MODELS[tier];
}

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
    return getConfiguredModel("advanced");
  }

  const tier = AGENT_MODEL_ASSIGNMENTS[agentName];
  return tier ? getConfiguredModel(tier) : null;
}

export function getRequiredModelForAgent(agentName: AgentName, context: ModelRoutingContext = {}): AiModelName {
  const model = getModelForAgent(agentName, context);
  if (!model) {
    throw new Error(`${agentName} is deterministic and must not call an AI model.`);
  }
  return model;
}

export function getDefaultRuntimeModel(): AiModelName {
  return getConfiguredModel("default");
}

export function getModelForSplitAgentRequest(input: SplitAgentModelRoutingInput): AiModelName {
  const message = input.message.toLowerCase();
  const status = input.context?.proposalStatus?.toLowerCase() ?? "";
  const participantCount = input.context?.participantNames?.length ?? 0;
  const totalCost = input.context?.totalCost ?? 0;

  if (
    /\b(dispute|disputed|unfair|fairness|argue|objection|resolve|opt out|change request|reconfirm|reconfirmation|complex|trade-?off|alternative|compare)\b/.test(message) ||
    /\b(changes_requested|recalculation_needed|needs_reconfirmation|blocked)\b/.test(status) ||
    totalCost >= 250000 ||
    participantCount >= 8
  ) {
    return getConfiguredModel("advanced");
  }

  if (
    /\b(remind|reminder|nudge|status|summarize|summary|explain|why|rewrite|shorten|message)\b/.test(message) &&
    totalCost < 100000
  ) {
    return getConfiguredModel("cheap");
  }

  return getConfiguredModel("default");
}
