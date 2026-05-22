import { describe, expect, it } from "vitest";
import { runOrchestrator } from "@/lib/agents/orchestrator-agent";

describe("orchestrator skeleton", () => {
  it("initializes workflow", async () => {
    const result = await runOrchestrator({ type: "user_message", message: "Split ₩120,000 dinner between 4 people" });
    expect(result.message).toContain("Drafted");
    expect(result.trace[0]).toMatchObject({ agent: "Orchestrator Agent", action: "initialize_workflow" });
  });

  it("rejects invalid direct specialized-agent bypass", async () => {
    const result = await runOrchestrator({ type: "direct_agent_call", agentName: "Intake Agent" });
    expect(result.trace[0].status).toBe("blocked");
    expect(result.message).toContain("cannot be called directly");
  });

  it("returns trace steps", async () => {
    const result = await runOrchestrator({ type: "user_message", message: "Split dinner" });
    expect(result.trace.length).toBeGreaterThan(0);
  });

  it("handles missing information gracefully", async () => {
    const result = await runOrchestrator({ type: "user_message", message: "" });
    expect(result.trace[0].status).toBe("blocked");
    expect(result.nextActions).toContain("Ask for missing fields");
  });

  it("routes money calculation through deterministic domain services", async () => {
    const result = await runOrchestrator({ type: "user_message", message: "Split ₩120,000 dinner between 4 people" });
    expect(result.proposal?.participants.map((participant) => participant.amountOwed)).toEqual([30000, 30000, 30000, 30000]);
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        agent: "Orchestrator Agent",
        action: "call_deterministic_split_calculator"
      })
    );
  });
});
