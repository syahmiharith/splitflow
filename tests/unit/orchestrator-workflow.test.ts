import { describe, expect, it } from "vitest";
import { airbnbMessage, dinnerMessage } from "@/lib/agents/agent-test-fixtures";
import { runOrchestrator } from "@/lib/agents/orchestrator-agent";
import { MemoryProposalRepository } from "@/lib/repositories/memory-proposal-repository";

describe("full orchestrator workflow", () => {
  it("completes Airbnb weighted split workflow", async () => {
    const repository = new MemoryProposalRepository();
    const result = await runOrchestrator({ type: "user_message", message: airbnbMessage }, { repository });
    expect(result.proposal?.splitMethod).toBe("weighted");
    expect(result.proposal?.participants.map((participant) => participant.amountOwed)).toEqual([53333, 106667, 106667, 106667, 106666]);
  });

  it("completes equal meal split workflow", async () => {
    const result = await runOrchestrator({ type: "user_message", message: dinnerMessage });
    expect(result.proposal?.splitMethod).toBe("equal");
    expect(result.proposal?.participants.map((participant) => participant.amountOwed)).toEqual([30000, 30000, 30000, 30000]);
  });

  it("handles missing info clarification workflow", async () => {
    const result = await runOrchestrator({ type: "user_message", message: "Split dinner with everyone." });
    expect(result.proposal).toBeUndefined();
    expect(result.message).toContain("I need");
  });

  it("handles participant opt-out and recalculation workflow", async () => {
    const repository = new MemoryProposalRepository();
    const draft = await runOrchestrator({ type: "user_message", message: dinnerMessage }, { repository });
    await runOrchestrator({ type: "send_proposal", proposalId: draft.proposal?.id ?? "" }, { repository });
    const result = await runOrchestrator(
      { type: "participant_response", proposalId: draft.proposal?.id ?? "", participantId: "participant-4", response: "opted_out" },
      { repository }
    );
    expect(result.proposal?.status).toBe("reconfirmation_required");
    expect(result.trace.map((step) => step.agent)).toContain("Recalculation Agent");
  });

  it("handles participant request-change workflow", async () => {
    const repository = new MemoryProposalRepository();
    const draft = await runOrchestrator({ type: "user_message", message: dinnerMessage }, { repository });
    const result = await runOrchestrator(
      { type: "participant_response", proposalId: draft.proposal?.id ?? "", participantId: "participant-2", response: "requested_change", note: "Joined late." },
      { repository }
    );
    expect(result.risk?.level).toBe("blocked");
    expect(result.recommendation?.primaryAction).toBe("resolve_change_request");
  });

  it("all participants accept and proposal becomes ready_to_pay", async () => {
    const repository = new MemoryProposalRepository();
    const draft = await runOrchestrator({ type: "user_message", message: dinnerMessage }, { repository });
    const proposalId = draft.proposal?.id ?? "";
    for (const participant of draft.proposal?.participants ?? []) {
      await runOrchestrator({ type: "participant_response", proposalId, participantId: participant.id, response: "accepted" }, { repository });
    }
    const proposal = await repository.get(proposalId);
    expect(proposal?.status).toBe("ready_to_pay");
    await expect(runOrchestrator({ type: "direct_agent_call", agentName: "Risk Decision Agent" })).resolves.toMatchObject({
      nextActions: ["Use the orchestrator endpoint."]
    });
  });

  it("unresolved participant blocks ready_to_pay", async () => {
    const repository = new MemoryProposalRepository();
    const draft = await runOrchestrator({ type: "user_message", message: dinnerMessage }, { repository });
    const proposalId = draft.proposal?.id ?? "";
    await runOrchestrator({ type: "participant_response", proposalId, participantId: "participant-1", response: "accepted" }, { repository });
    const proposal = await repository.get(proposalId);
    expect(proposal?.status).not.toBe("ready_to_pay");
  });

  it("orchestrator trace shows each agent step in order", async () => {
    const result = await runOrchestrator({ type: "user_message", message: airbnbMessage });
    expect(result.trace.map((step) => step.agent)).toEqual([
      "Orchestrator Agent",
      "Intake Agent",
      "Split Planning Agent",
      "Orchestrator Agent",
      "Proposal Agent",
      "Risk Decision Agent",
      "Recommendation Agent"
    ]);
  });

  it("can route organizer-facing prose through an injected Agents SDK runtime", async () => {
    const result = await runOrchestrator(
      { type: "user_message", message: dinnerMessage },
      {
        agentsRuntime: {
          async draftOrganizerMessage() {
            return "SDK drafted organizer update.";
          }
        }
      }
    );

    expect(result.message).toBe("SDK drafted organizer update.");
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        agent: "Orchestrator Agent",
        action: "run_openai_agents_sdk"
      })
    );
    expect(result.proposal?.participants.map((participant) => participant.amountOwed)).toEqual([30000, 30000, 30000, 30000]);
  });
});
