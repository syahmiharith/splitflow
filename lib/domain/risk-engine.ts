import { summarizeParticipantResponses } from "@/lib/domain/participant-response";
import type { Proposal, RiskAssessment, RiskLevel } from "@/lib/domain/proposal-types";

function rank(level: RiskLevel): number {
  return { low: 0, medium: 1, high: 2, blocked: 3 }[level];
}

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return rank(a) >= rank(b) ? a : b;
}

export function evaluateRisk(proposal: Proposal): RiskAssessment {
  const summary = summarizeParticipantResponses(proposal);
  const active = proposal.participants.filter((participant) => participant.responseStatus !== "opted_out");
  const acceptedAmount = active
    .filter((participant) => participant.responseStatus === "accepted")
    .reduce((sum, participant) => sum + participant.amountOwed, 0);
  const pendingParticipantIds = active
    .filter((participant) => participant.responseStatus === "pending" || participant.responseStatus === "reconfirmation_required")
    .map((participant) => participant.id);
  const reasons: string[] = [];
  let level: RiskLevel = "low";

  if (active.length === 0) {
    reasons.push("No active participants remain in the proposal.");
    level = "blocked";
  }

  if (summary.accepted === 0) {
    reasons.push("No participants have accepted the proposal yet.");
    level = maxRisk(level, "blocked");
  }

  if (summary.pending > 0) {
    reasons.push(`${summary.pending} participant response${summary.pending === 1 ? " is" : "s are"} still pending.`);
    level = maxRisk(level, proposal.totalAmount >= 250000 ? "high" : "medium");
  }

  if (summary.reconfirmation_required > 0) {
    reasons.push("Changed amounts require participant reconfirmation.");
    level = maxRisk(level, "blocked");
  }

  if (summary.requested_change > 0 || proposal.changeRequests.some((request) => !request.resolved)) {
    reasons.push("There are unresolved participant change requests.");
    level = maxRisk(level, "blocked");
  }

  if (proposal.status === "recalculation_required") {
    reasons.push("The proposal requires recalculation before payment readiness can be decided.");
    level = maxRisk(level, "blocked");
  }

  const frontingExposure = Math.max(0, proposal.totalAmount - acceptedAmount);
  if (frontingExposure > 0 && level === "low") {
    reasons.push("Organizer still has unrecovered upfront exposure.");
    level = "medium";
  }

  if (reasons.length === 0) {
    reasons.push("All active participants accepted and calculated amounts are stable.");
  }

  const recommendedNextAction =
    level === "blocked"
      ? "Resolve blockers before payment or booking."
      : level === "high"
        ? "Wait before booking and follow up with pending participants."
        : level === "medium"
          ? "Send reminders before proceeding."
          : "Proceed to payment or booking review.";

  return {
    level,
    reasons,
    recommendedNextAction,
    frontingExposure,
    pendingParticipantIds
  };
}
