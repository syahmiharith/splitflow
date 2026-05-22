import { describe, expect, it } from "vitest";
import { createOrganizerSendPreview, createParticipantMessage } from "@/lib/agents/participant-communication-agent";
import { runRecalculationAgent } from "@/lib/agents/recalculation-agent";
import { runRecommendationAgent } from "@/lib/agents/recommendation-agent";
import { runResponseTrackingAgent } from "@/lib/agents/response-tracking-agent";
import { runRiskDecisionAgent } from "@/lib/agents/risk-decision-agent";
import { createAcceptedDinnerProposal } from "@/lib/agents/agent-test-fixtures";
import type { Proposal } from "@/lib/domain/proposal-types";

function pendingProposal(): Proposal {
  return {
    ...createAcceptedDinnerProposal(),
    status: "sent",
    participants: createAcceptedDinnerProposal().participants.map((participant, index) => ({
      ...participant,
      responseStatus: index === 0 ? "accepted" : "pending"
    }))
  };
}

describe("Participant Communication Agent", () => {
  it("generates participant message with amount", () => {
    const proposal = createAcceptedDinnerProposal();
    const message = createParticipantMessage(proposal, "p1");
    expect(message.message).toContain("₩30,000");
  });

  it("includes accept/request change/opt out actions", () => {
    const message = createParticipantMessage(createAcceptedDinnerProposal(), "p1");
    expect(message.actions).toEqual(["accept", "request_change", "opt_out"]);
  });

  it("uses calculated amount from proposal and avoids unnecessary participant detail", () => {
    const message = createParticipantMessage(createAcceptedDinnerProposal(), "p1");
    expect(message.message).toContain("₩30,000");
    expect(message.message).not.toContain("Participant 2 owes");
  });

  it("generates organizer preview", () => {
    expect(createOrganizerSendPreview(createAcceptedDinnerProposal())).toContain("Send Dinner");
  });
});

describe("Response Tracking Agent", () => {
  it("participant can accept", () => {
    const result = runResponseTrackingAgent(pendingProposal(), { participantId: "p2", status: "accepted" });
    expect(result.proposal.participants.find((participant) => participant.id === "p2")?.responseStatus).toBe("accepted");
  });

  it("participant can opt out and trigger recalculation", () => {
    const result = runResponseTrackingAgent(pendingProposal(), { participantId: "p2", status: "opted_out" });
    expect(result.recalculationRequired).toBe(true);
    expect(result.proposal.status).toBe("recalculation_required");
  });

  it("participant can request change", () => {
    const result = runResponseTrackingAgent(pendingProposal(), { participantId: "p2", status: "requested_change", note: "Joined late." });
    expect(result.proposal.changeRequests).toHaveLength(1);
    expect(result.proposal.status).toBe("change_requested");
  });

  it("duplicate response is handled safely", () => {
    const first = runResponseTrackingAgent(pendingProposal(), { participantId: "p2", status: "accepted" });
    const second = runResponseTrackingAgent(first.proposal, { participantId: "p2", status: "accepted" });
    expect(second.proposal.participants.find((participant) => participant.id === "p2")?.responseStatus).toBe("accepted");
  });

  it("proposal becomes partially accepted when some accept", () => {
    expect(runResponseTrackingAgent(pendingProposal(), { participantId: "p2", status: "accepted" }).proposal.status).toBe("partially_accepted");
  });

  it("proposal becomes accepted-ready when all accept", () => {
    const proposal = pendingProposal();
    const accepted = {
      ...proposal,
      participants: proposal.participants.map((participant) => ({ ...participant, responseStatus: "accepted" as const }))
    };
    expect(runResponseTrackingAgent(accepted, { participantId: "p2", status: "accepted" }).proposal.status).toBe("ready_to_pay");
  });
});

describe("Recalculation Agent", () => {
  it("recalculates after participant opts out", () => {
    const tracked = runResponseTrackingAgent(createAcceptedDinnerProposal(), { participantId: "p4", status: "opted_out" });
    const result = runRecalculationAgent(tracked.proposal);
    expect(result.proposal.participants.find((participant) => participant.id === "p4")?.amountOwed).toBe(0);
  });

  it("detects increased amount and requires reconfirmation", () => {
    const tracked = runResponseTrackingAgent(createAcceptedDinnerProposal(), { participantId: "p4", status: "opted_out" });
    const result = runRecalculationAgent(tracked.proposal);
    expect(result.changedParticipantIds).toEqual(["p1", "p2", "p3"]);
    expect(result.proposal.status).toBe("reconfirmation_required");
  });

  it("does not require reconfirmation when amount does not change", () => {
    const result = runRecalculationAgent(createAcceptedDinnerProposal());
    expect(result.changedParticipantIds).toEqual([]);
  });

  it("preserves audit trail of old vs new amount", () => {
    const tracked = runResponseTrackingAgent(createAcceptedDinnerProposal(), { participantId: "p4", status: "opted_out" });
    const result = runRecalculationAgent(tracked.proposal);
    expect(result.auditTrail.find((entry) => entry.participantId === "p1")).toEqual({ participantId: "p1", oldAmount: 30000, newAmount: 40000 });
  });

  it("handles edge case where too few participants remain", () => {
    const proposal = {
      ...createAcceptedDinnerProposal(),
      participants: createAcceptedDinnerProposal().participants.map((participant) => ({ ...participant, responseStatus: "opted_out" as const }))
    };
    expect(runRecalculationAgent(proposal).proposal.status).toBe("blocked");
  });
});

describe("Risk Decision and Recommendation Agents", () => {
  it("low risk when all accepted and amount stable", () => {
    expect(runRiskDecisionAgent(createAcceptedDinnerProposal()).level).toBe("low");
  });

  it("medium risk when some pending", () => {
    expect(runRiskDecisionAgent(pendingProposal()).level).toBe("medium");
  });

  it("high risk when amount is high and participants are pending", () => {
    const proposal = { ...pendingProposal(), totalAmount: 480000 };
    expect(runRiskDecisionAgent(proposal).level).toBe("high");
  });

  it("blocked when there are unresolved change requests", () => {
    const tracked = runResponseTrackingAgent(pendingProposal(), { participantId: "p2", status: "requested_change" });
    expect(runRiskDecisionAgent(tracked.proposal).level).toBe("blocked");
  });

  it("blocked when recalculation is required", () => {
    const tracked = runResponseTrackingAgent(createAcceptedDinnerProposal(), { participantId: "p4", status: "opted_out" });
    expect(runRiskDecisionAgent(tracked.proposal).level).toBe("blocked");
  });

  it("recommends proceed_to_pay when all accepted and risk is low", () => {
    const proposal = createAcceptedDinnerProposal();
    expect(runRecommendationAgent({ proposal, risk: runRiskDecisionAgent(proposal) }).primaryAction).toBe("proceed_to_pay");
  });

  it("recommends send_reminder when participants are pending", () => {
    const proposal = pendingProposal();
    expect(runRecommendationAgent({ proposal, risk: runRiskDecisionAgent(proposal) }).primaryAction).toBe("send_reminder");
  });

  it("recommends request_reconfirmation when recalculation changed amounts", () => {
    const tracked = runResponseTrackingAgent(createAcceptedDinnerProposal(), { participantId: "p4", status: "opted_out" });
    const recalculation = runRecalculationAgent(tracked.proposal);
    expect(runRecommendationAgent({ proposal: recalculation.proposal, risk: runRiskDecisionAgent(recalculation.proposal), recalculation }).primaryAction).toBe("request_reconfirmation");
  });

  it("recommends resolve_change_request when unresolved change requests exist", () => {
    const tracked = runResponseTrackingAgent(pendingProposal(), { participantId: "p2", status: "requested_change" });
    expect(runRecommendationAgent({ proposal: tracked.proposal, risk: runRiskDecisionAgent(tracked.proposal) }).primaryAction).toBe("resolve_change_request");
  });

  it("recommends do_not_pay when risk is blocked without a specific recovery path", () => {
    const proposal = { ...pendingProposal(), status: "recalculation_required" as const };
    expect(runRecommendationAgent({ proposal, risk: runRiskDecisionAgent(proposal) }).primaryAction).toBe("do_not_pay");
  });

  it("includes alternatives for medium and high risk cases", () => {
    const proposal = pendingProposal();
    expect(runRecommendationAgent({ proposal, risk: runRiskDecisionAgent(proposal) }).alternatives.length).toBeGreaterThan(0);
  });

  it("does not calculate or mutate proposal amounts", () => {
    const proposal = pendingProposal();
    const before = proposal.participants.map((participant) => participant.amountOwed);
    runRecommendationAgent({ proposal, risk: runRiskDecisionAgent(proposal) });
    expect(proposal.participants.map((participant) => participant.amountOwed)).toEqual(before);
  });
});
