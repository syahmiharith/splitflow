import { describe, expect, it } from "vitest";
import { runIntakeAgent } from "@/lib/agents/intake-agent";
import { runSplitPlanningAgent } from "@/lib/agents/split-planning-agent";
import { airbnbMessage, dinnerMessage, giftMessage } from "@/lib/agents/agent-test-fixtures";

describe("Split Planning Agent", () => {
  it("chooses equal split for basic meal", () => {
    const plan = runSplitPlanningAgent(runIntakeAgent(dinnerMessage));
    expect(plan.method).toBe("equal");
  });

  it("chooses weighted split for different nights", () => {
    const plan = runSplitPlanningAgent(runIntakeAgent(airbnbMessage));
    expect(plan.method).toBe("weighted");
  });

  it("chooses percentage split when percentages provided", () => {
    const intake = runIntakeAgent("Split ₩100,000 dinner between 2 people by 70% and 30%.");
    const plan = runSplitPlanningAgent({
      ...intake,
      explicitMethod: "percentage",
      participants: [
        { id: "a", name: "A", percentage: 70 },
        { id: "b", name: "B", percentage: 30 }
      ]
    });
    expect(plan.method).toBe("percentage");
  });

  it("chooses fixed split when fixed contribution provided", () => {
    const plan = runSplitPlanningAgent(runIntakeAgent(giftMessage));
    expect(plan.method).toBe("fixed");
  });

  it("returns deterministic calculator input", () => {
    const plan = runSplitPlanningAgent(runIntakeAgent(dinnerMessage));
    expect(plan.calculatorInput).toMatchObject({ totalAmount: 120000, currency: "KRW", method: "equal" });
    expect(plan.calculatorInput.participants).toHaveLength(4);
  });

  it("does not calculate final shares itself", () => {
    const plan = runSplitPlanningAgent(runIntakeAgent(dinnerMessage));
    expect("shares" in plan).toBe(false);
  });
});
