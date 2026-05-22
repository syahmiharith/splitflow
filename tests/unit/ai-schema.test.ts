import { describe, expect, it } from "vitest";
import { parseAiResponsePayload } from "@/lib/ai/schemas";

describe("AI structured output schema", () => {
  it("accepts a valid split agent response", () => {
    const result = parseAiResponsePayload({
      assistantMessage: "I created a draft proposal.",
      intent: "draft_proposal",
      proposalDraft: {
        title: "Weekend Airbnb",
        description: "Shared stay",
        totalCost: 320000,
        currency: "KRW",
        splitMethod: "equal",
        costItems: [{ label: "Stay", amount: 320000, paidBy: "Syahmi" }],
        participants: [{ name: "Amir", shareAmount: 80000, roleNote: "Participant" }],
        fairnessNote: "Equal split is clear if everyone stays the same duration.",
        recommendation: "Confirm the cancellation rule before booking."
      },
      agentUpdates: [{ name: "Intake Agent", description: "Parsed proposal", status: "completed" }]
    });

    expect(result.intent).toBe("draft_proposal");
  });

  it("rejects malformed AI output", () => {
    expect(() => parseAiResponsePayload({ assistantMessage: "Missing fields" })).toThrow();
  });
});
