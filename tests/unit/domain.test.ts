import { describe, expect, it } from "vitest";
import { applyParticipantResponse } from "@/lib/domain/participant-response";
import { deriveProposalState, markReconfirmationRequired } from "@/lib/domain/proposal-state";
import type { Proposal } from "@/lib/domain/proposal-types";
import { evaluateRisk } from "@/lib/domain/risk-engine";
import { calculateSplit } from "@/lib/domain/split-calculator";

function baseProposal(overrides: Partial<Proposal> = {}): Proposal {
  const calculation = calculateSplit({
    totalAmount: 120000,
    currency: "KRW",
    method: "equal",
    participants: [
      { id: "a", name: "A" },
      { id: "b", name: "B" },
      { id: "c", name: "C" }
    ]
  });

  return {
    id: "proposal-1",
    title: "Dinner",
    organizerName: "You",
    expenseType: "meal",
    totalAmount: 120000,
    currency: "KRW",
    splitMethod: "equal",
    items: [{ id: "dinner", label: "Dinner", amount: 120000 }],
    participants: calculation.shares.map((share) => ({
      id: share.participantId,
      name: share.name,
      amountOwed: share.amount,
      responseStatus: "pending",
      paymentStatus: "unpaid"
    })),
    status: "draft",
    assumptions: [],
    requiredConfirmations: [],
    fairnessExplanation: "Equal split.",
    calculation,
    changeRequests: [],
    createdAt: "2026-05-23T00:00:00.000Z",
    updatedAt: "2026-05-23T00:00:00.000Z",
    ...overrides
  };
}

describe("domain split calculator", () => {
  it("handles equal split with deterministic rounding", () => {
    const result = calculateSplit({
      totalAmount: 100000,
      currency: "KRW",
      method: "equal",
      participants: [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" }
      ]
    });

    expect(result.shares.map((share) => share.amount)).toEqual([33334, 33333, 33333]);
    expect(result.shares.reduce((sum, share) => sum + share.amount, 0)).toBe(100000);
  });

  it("handles weighted split by nights stayed", () => {
    const result = calculateSplit({
      totalAmount: 480000,
      currency: "KRW",
      method: "weighted",
      participants: [
        { id: "amir", name: "Amir", weight: 1 },
        { id: "p2", name: "Participant 2", weight: 2 },
        { id: "p3", name: "Participant 3", weight: 2 },
        { id: "p4", name: "Participant 4", weight: 2 },
        { id: "p5", name: "Participant 5", weight: 2 }
      ]
    });

    expect(result.shares.map((share) => share.amount)).toEqual([53333, 106667, 106667, 106667, 106666]);
    expect(result.shares.reduce((sum, share) => sum + share.amount, 0)).toBe(480000);
  });

  it("handles percentage split", () => {
    const result = calculateSplit({
      totalAmount: 100000,
      currency: "KRW",
      method: "percentage",
      participants: [
        { id: "a", name: "A", percentage: 50 },
        { id: "b", name: "B", percentage: 30 },
        { id: "c", name: "C", percentage: 20 }
      ]
    });

    expect(result.shares.map((share) => share.amount)).toEqual([50000, 30000, 20000]);
  });

  it("handles fixed amount split with remaining balance", () => {
    const result = calculateSplit({
      totalAmount: 300000,
      currency: "KRW",
      method: "fixed",
      participants: [
        { id: "aina", name: "Aina", fixedAmount: 50000 },
        { id: "b", name: "B" },
        { id: "c", name: "C" }
      ]
    });

    expect(result.shares.map((share) => share.amount)).toEqual([50000, 125000, 125000]);
  });

  it("rejects invalid input", () => {
    expect(() =>
      calculateSplit({
        totalAmount: -1,
        currency: "KRW",
        method: "equal",
        participants: [{ id: "a", name: "A" }]
      })
    ).toThrow("Amount cannot be negative.");

    expect(() =>
      calculateSplit({
        totalAmount: 1000,
        currency: "KRW",
        method: "percentage",
        participants: [{ id: "a", name: "A", percentage: 90 }]
      })
    ).toThrow("Percentages must add up to 100.");
  });
});

describe("proposal state and risk", () => {
  it("participant opt-out changes state and increases risk", () => {
    const proposal = baseProposal({
      participants: baseProposal().participants.map((participant) => ({ ...participant, responseStatus: "accepted" }))
    });

    const changed = applyParticipantResponse(proposal, { participantId: "c", status: "opted_out" });
    expect(changed.participants.find((participant) => participant.id === "c")?.responseStatus).toBe("opted_out");
    expect(deriveProposalState(changed)).toBe("ready_to_pay");
  });

  it("amount changes require reconfirmation", () => {
    const proposal = baseProposal({
      participants: baseProposal().participants.map((participant) => ({ ...participant, responseStatus: "accepted" }))
    });

    const changed = markReconfirmationRequired(proposal, ["a", "b"]);
    expect(changed.status).toBe("reconfirmation_required");
    expect(changed.participants.filter((participant) => participant.responseStatus === "reconfirmation_required")).toHaveLength(2);
  });

  it("risk increases when participants are pending", () => {
    const proposal = baseProposal();
    const risk = evaluateRisk({
      ...proposal,
      participants: proposal.participants.map((participant, index) => ({
        ...participant,
        responseStatus: index === 0 ? "accepted" : "pending"
      }))
    });

    expect(risk.level).toBe("medium");
    expect(risk.pendingParticipantIds).toEqual(["b", "c"]);
    expect(risk.reasons).toContain("2 participant responses are still pending.");
  });

  it("uses singular pending-response copy", () => {
    const proposal = baseProposal();
    const risk = evaluateRisk({
      ...proposal,
      participants: proposal.participants.map((participant, index) => ({
        ...participant,
        responseStatus: index === 0 || index === 1 ? "accepted" : "pending"
      }))
    });

    expect(risk.level).toBe("medium");
    expect(risk.pendingParticipantIds).toEqual(["c"]);
    expect(risk.reasons).toContain("1 participant response is still pending.");
  });

  it("blocks when pending participants also need reconfirmation", () => {
    const proposal = baseProposal();
    const risk = evaluateRisk({
      ...proposal,
      participants: proposal.participants.map((participant, index) => ({
        ...participant,
        responseStatus: index === 0 ? "accepted" : index === 1 ? "reconfirmation_required" : "pending"
      })),
      status: "reconfirmation_required"
    });

    expect(risk.level).toBe("blocked");
    expect(risk.pendingParticipantIds).toEqual(["b", "c"]);
    expect(risk.reasons).toContain("1 participant response is still pending.");
    expect(risk.reasons).toContain("Changed amounts require participant reconfirmation.");
  });

  it("risk blocks payment when no participants accepted", () => {
    const risk = evaluateRisk(baseProposal());
    expect(risk.level).toBe("blocked");
    expect(risk.reasons).toContain("No participants have accepted the proposal yet.");
  });

  it("reports accepted exposure as medium risk until organizer is recovered", () => {
    const proposal = baseProposal({
      participants: baseProposal().participants.map((participant) => ({
        ...participant,
        responseStatus: "accepted",
        amountOwed: participant.id === "a" ? 40000 : 0
      }))
    });

    const risk = evaluateRisk(proposal);
    expect(risk.level).toBe("medium");
    expect(risk.frontingExposure).toBe(80000);
    expect(risk.pendingParticipantIds).toEqual([]);
    expect(risk.reasons).toContain("Organizer still has unrecovered upfront exposure.");
  });
});
