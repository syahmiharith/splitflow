import type { AgentRuntimeMetadata, AgentTraceStep, OpenAiAgentsSdkRuntimeMetadata, OrchestratorEvent, OrchestratorResponse } from "@/lib/agents/agent-types";
import { runIntakeAgent } from "@/lib/agents/intake-agent";
import { createOrganizerSendPreview } from "@/lib/agents/participant-communication-agent";
import { runProposalAgent } from "@/lib/agents/proposal-agent";
import { runRecalculationAgent } from "@/lib/agents/recalculation-agent";
import { runRecommendationAgent } from "@/lib/agents/recommendation-agent";
import { runResponseTrackingAgent } from "@/lib/agents/response-tracking-agent";
import { runRiskDecisionAgent } from "@/lib/agents/risk-decision-agent";
import { runSplitPlanningAgent } from "@/lib/agents/split-planning-agent";
import { calculateSplit } from "@/lib/domain/split-calculator";
import { markProposalSent } from "@/lib/domain/proposal-state";
import { isOpenAiAgentsSdkEnabled, type OpenAiAgentsRuntime } from "@/lib/agents/openai-agents-runtime";
import type { ProposalRepository } from "@/lib/repositories/proposal-repository";

export type OrchestratorOptions = {
  repository?: ProposalRepository;
  agentsRuntime?: OpenAiAgentsRuntime;
};

function trace(agent: AgentTraceStep["agent"], action: string, detail: string, status: AgentTraceStep["status"] = "completed"): AgentTraceStep {
  return { agent, action, status, detail };
}

function createSdkRuntimeMetadata(agentsRuntime?: OpenAiAgentsRuntime): OpenAiAgentsSdkRuntimeMetadata {
  const apiKeyPresent = Boolean(process.env.OPENAI_API_KEY);
  return {
    envFlagEnabled: isOpenAiAgentsSdkEnabled(),
    apiKeyPresent,
    runtimeCreated: Boolean(agentsRuntime),
    attempted: false,
    invoked: false,
    returnedOutput: false
  };
}

function createRuntimeMetadata(agentsRuntime?: OpenAiAgentsRuntime): AgentRuntimeMetadata {
  return {
    route: "/api/agent",
    backend: "runOrchestrator",
    openAiAgentsSdk: createSdkRuntimeMetadata(agentsRuntime)
  };
}

export async function runOrchestrator(event: OrchestratorEvent, options: OrchestratorOptions = {}): Promise<OrchestratorResponse> {
  const runtime = createRuntimeMetadata(options.agentsRuntime);

  if (event.type === "direct_agent_call") {
    return {
      message: "Specialized agents cannot be called directly. Route workflow requests through the Orchestrator Agent.",
      nextActions: ["Use the orchestrator endpoint."],
      trace: [
        {
          agent: "Orchestrator Agent",
          action: "reject_direct_agent_call",
          status: "blocked",
          detail: `Rejected direct call to ${event.agentName}.`
        }
      ],
      runtime
    };
  }

  if (event.type === "user_message") {
    const steps: AgentTraceStep[] = [trace("Orchestrator Agent", "initialize_workflow", "Received organizer message.", event.message.trim() ? "completed" : "blocked")];
    if (!event.message.trim()) {
      return {
        message: "Tell me what you are splitting, the total amount, and who is involved.",
        nextActions: ["Ask for missing fields"],
        trace: steps,
        runtime
      };
    }

    const intake = runIntakeAgent(event.message);
    steps.push(trace("Intake Agent", "extract_expense_context", `Missing fields: ${intake.missingFields.join(", ") || "none"}.`, intake.missingFields.length > 0 ? "blocked" : "completed"));

    if (intake.missingFields.length > 0) {
      return {
        message: `I need ${intake.missingFields.join(" and ")} before I can draft the proposal.`,
        nextActions: ["Ask clarifying question"],
        trace: steps,
        runtime
      };
    }

    const splitPlan = runSplitPlanningAgent(intake);
    steps.push(trace("Split Planning Agent", "choose_split_strategy", splitPlan.reason));

    const calculation = calculateSplit(splitPlan.calculatorInput);
    steps.push(trace("Orchestrator Agent", "call_deterministic_split_calculator", "Called deterministic domain calculator; no agent calculated money."));

    const proposal = runProposalAgent({ intake, splitPlan, calculation });
    steps.push(trace("Proposal Agent", "create_proposal", `Created ${proposal.title}.`));

    const risk = runRiskDecisionAgent(proposal);
    steps.push(trace("Risk Decision Agent", "evaluate_payment_readiness", risk.recommendedNextAction));

    const recommendation = runRecommendationAgent({ proposal, risk });
    steps.push(trace("Recommendation Agent", "recommend_next_action", recommendation.primaryAction));

    let sdkMessage: string | undefined;
    if (!options.agentsRuntime) {
      steps.push(trace("Orchestrator Agent", "check_openai_agents_sdk", "OpenAI Agents SDK runtime is disabled.", "blocked"));
    } else {
      steps.push(trace("Orchestrator Agent", "check_openai_agents_sdk", "OpenAI Agents SDK runtime is enabled."));
      runtime.openAiAgentsSdk.attempted = true;
      const sdkResult = await options.agentsRuntime.draftOrganizerMessage({
        userMessage: event.message,
        proposal,
        risk,
        recommendation,
        trace: steps
      });
      runtime.openAiAgentsSdk.invoked = true;

      if (sdkResult.status === "invoked") {
        sdkMessage = sdkResult.output;
        runtime.openAiAgentsSdk.returnedOutput = true;
        steps.push(trace("Orchestrator Agent", "run_openai_agents_sdk", "Drafted organizer-facing message through @openai/agents."));
      } else if (sdkResult.status === "no_output") {
        runtime.openAiAgentsSdk.errorCode = "no_output";
        steps.push(trace("Orchestrator Agent", "run_openai_agents_sdk", "SDK returned no string output; deterministic fallback used.", "blocked"));
      } else {
        runtime.openAiAgentsSdk.errorCode = sdkResult.errorCode;
        steps.push(trace("Orchestrator Agent", "run_openai_agents_sdk", "SDK call failed; deterministic fallback used.", "blocked"));
      }
    }

    await options.repository?.save(proposal);

    return {
      message: sdkMessage ?? `Drafted ${proposal.title}. ${recommendation.recommendation}`,
      proposal,
      risk,
      recommendation,
      nextActions: [recommendation.primaryAction, "review_proposal", "send_proposal"],
      trace: steps,
      runtime
    };
  }

  if (event.type === "send_proposal") {
    const proposal = await options.repository?.get(event.proposalId);
    if (!proposal) {
      return {
        message: "Proposal was not found.",
        nextActions: ["Create proposal"],
        trace: [trace("Orchestrator Agent", "load_proposal", "Proposal was not found.", "blocked")],
        runtime
      };
    }

    const sent = markProposalSent(proposal);
    const preview = createOrganizerSendPreview(sent);
    const risk = runRiskDecisionAgent(sent);
    const recommendation = runRecommendationAgent({ proposal: sent, risk });
    await options.repository?.save(sent);

    return {
      message: preview,
      proposal: sent,
      risk,
      recommendation,
      nextActions: ["wait_for_responses", recommendation.primaryAction],
      trace: [
        trace("Orchestrator Agent", "load_proposal", "Loaded proposal."),
        trace("Participant Communication Agent", "prepare_send_preview", preview),
        trace("Risk Decision Agent", "evaluate_payment_readiness", risk.recommendedNextAction),
        trace("Recommendation Agent", "recommend_next_action", recommendation.primaryAction)
      ],
      runtime
    };
  }

  const proposal = await options.repository?.get(event.proposalId);
  if (!proposal) {
    return {
      message: "Proposal was not found.",
      nextActions: ["Create proposal"],
      trace: [trace("Orchestrator Agent", "load_proposal", "Proposal was not found.", "blocked")],
      runtime
    };
  }

  const tracked = runResponseTrackingAgent(proposal, {
    participantId: event.participantId,
    status: event.response,
    note: event.note
  });
  const steps = [
    trace("Orchestrator Agent", "load_proposal", "Loaded proposal."),
    trace("Response Tracking Agent", "record_participant_response", `${event.participantId} responded with ${event.response}.`)
  ];

  const recalculation = tracked.recalculationRequired ? runRecalculationAgent(tracked.proposal) : undefined;
  if (recalculation) {
    steps.push(trace("Recalculation Agent", "recalculate_after_response", recalculation.explanation));
  }

  const updatedProposal = recalculation?.proposal ?? tracked.proposal;
  const risk = runRiskDecisionAgent(updatedProposal);
  steps.push(trace("Risk Decision Agent", "evaluate_payment_readiness", risk.recommendedNextAction));
  const recommendation = runRecommendationAgent({ proposal: updatedProposal, risk, recalculation });
  steps.push(trace("Recommendation Agent", "recommend_next_action", recommendation.primaryAction));
  await options.repository?.save(updatedProposal);

  return {
    message: recommendation.recommendation,
    proposal: updatedProposal,
    risk,
    recommendation,
    nextActions: [recommendation.primaryAction],
    trace: steps,
    runtime
  };
}
