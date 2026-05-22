import { evaluateRisk } from "@/lib/domain/risk-engine";
import type { Proposal, RiskAssessment } from "@/lib/domain/proposal-types";

export function runRiskDecisionAgent(proposal: Proposal): RiskAssessment {
  return evaluateRisk(proposal);
}
