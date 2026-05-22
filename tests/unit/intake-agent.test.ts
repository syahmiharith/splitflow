import { describe, expect, it } from "vitest";
import { runIntakeAgent } from "@/lib/agents/intake-agent";
import { airbnbMessage } from "@/lib/agents/agent-test-fixtures";

describe("Intake Agent", () => {
  it("extracts amount and KRW currency", () => {
    const result = runIntakeAgent(airbnbMessage);
    expect(result.totalAmount).toBe(480000);
    expect(result.currency).toBe("KRW");
  });

  it("extracts participant count", () => {
    const result = runIntakeAgent(airbnbMessage);
    expect(result.participants).toHaveLength(5);
  });

  it("extracts different stay duration", () => {
    const result = runIntakeAgent(airbnbMessage);
    expect(result.participants[0]).toMatchObject({ name: "Amir", weight: 1, metadata: { nights: 1 } });
    expect(result.participants[1]).toMatchObject({ name: "Participant 2", weight: 2, metadata: { nights: 2 } });
  });

  it("returns missing fields when total amount is missing", () => {
    const result = runIntakeAgent("Split dinner between 4 people.");
    expect(result.missingFields).toContain("totalAmount");
  });

  it("returns missing fields when participants are missing", () => {
    const result = runIntakeAgent("Split a ₩120,000 dinner.");
    expect(result.missingFields).toContain("participants");
  });

  it("does not calculate split amounts", () => {
    const result = runIntakeAgent(airbnbMessage);
    expect(result.participants.some((participant) => "amount" in participant)).toBe(false);
  });
});
