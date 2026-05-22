import { describe, expect, it } from "vitest";
import { runIntakeAgent } from "@/lib/agents/intake-agent";
import { runProposalAgent } from "@/lib/agents/proposal-agent";
import { runSplitPlanningAgent } from "@/lib/agents/split-planning-agent";
import { airbnbMessage, dinnerMessage } from "@/lib/agents/agent-test-fixtures";
import { calculateSplit } from "@/lib/domain/split-calculator";

function proposalFromMessage(message: string) {
  const intake = runIntakeAgent(message);
  const splitPlan = runSplitPlanningAgent(intake);
  const calculation = calculateSplit(splitPlan.calculatorInput);
  return { proposal: runProposalAgent({ intake, splitPlan, calculation, now: "2026-05-23T00:00:00.000Z" }), calculation };
}

describe("Proposal Agent", () => {
  it("creates proposal from equal split result", () => {
    const { proposal } = proposalFromMessage(dinnerMessage);
    expect(proposal.title).toBe("Dinner Split");
    expect(proposal.splitMethod).toBe("equal");
  });

  it("creates proposal from weighted split result", () => {
    const { proposal } = proposalFromMessage(airbnbMessage);
    expect(proposal.title).toBe("Busan Airbnb");
    expect(proposal.splitMethod).toBe("weighted");
  });

  it("includes assumptions", () => {
    const { proposal } = proposalFromMessage(airbnbMessage);
    expect(proposal.assumptions).toContain("Different stay duration");
  });

  it("includes participant amounts from calculator output", () => {
    const { proposal, calculation } = proposalFromMessage(dinnerMessage);
    expect(proposal.participants.map((participant) => participant.amountOwed)).toEqual(calculation.shares.map((share) => share.amount));
  });

  it("does not alter calculated amounts", () => {
    const { proposal, calculation } = proposalFromMessage(airbnbMessage);
    expect(proposal.participants.reduce((sum, participant) => sum + participant.amountOwed, 0)).toBe(calculation.totalAmount);
  });

  it("handles rounding display data consistently", () => {
    const { proposal } = proposalFromMessage("Split ₩100,000 dinner equally between 3 people.");
    expect(proposal.participants.map((participant) => participant.amountOwed)).toEqual([33334, 33333, 33333]);
  });
});
