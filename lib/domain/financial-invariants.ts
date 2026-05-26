import type { PaymentRecord, Proposal } from "@/lib/types";

export type FinancialInvariantCode =
  | "missing_calculation"
  | "money_not_integer"
  | "total_mismatch"
  | "paid_total_mismatch"
  | "share_total_mismatch"
  | "net_balance_mismatch"
  | "calculation_warning"
  | "unresolved_claim_ready"
  | "conflicting_payment_claims"
  | "participant_not_confirmed_ready";

export type FinancialInvariantViolation = {
  code: FinancialInvariantCode;
  message: string;
};

const UNRESOLVED_CLAIM_STATUSES = new Set<PaymentRecord["status"]>(["claimed", "disputed"]);

function sum(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

function isIntegerMoney(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value);
}

function unresolvedPaymentRecords(proposal: Proposal): PaymentRecord[] {
  return (proposal.paymentRecords ?? []).filter((record) => UNRESOLVED_CLAIM_STATUSES.has(record.status));
}

export function hasUnresolvedPaymentClaims(proposal: Proposal): boolean {
  return unresolvedPaymentRecords(proposal).length > 0;
}

export function findConflictingPaymentClaims(proposal: Proposal): PaymentRecord[] {
  const unresolved = unresolvedPaymentRecords(proposal);
  const claimsByParticipant = new Map<string, PaymentRecord[]>();

  for (const record of unresolved) {
    const key = `${record.fromParticipantId}:${record.toParticipantId}:${record.kind}`;
    claimsByParticipant.set(key, [...(claimsByParticipant.get(key) ?? []), record]);
  }

  return Array.from(claimsByParticipant.values())
    .filter((records) => {
      if (records.length < 2) return false;
      const amounts = new Set(records.map((record) => record.amount));
      const statuses = new Set(records.map((record) => record.status));
      return amounts.size > 1 || statuses.size > 1;
    })
    .flat();
}

export function validateProposalFinancialInvariants(proposal: Proposal): FinancialInvariantViolation[] {
  const violations: FinancialInvariantViolation[] = [];
  const calculation = proposal.calculationResult;

  const moneyValues = [
    proposal.totalCost,
    ...proposal.costItems.map((item) => item.amount),
    ...proposal.participants.map((participant) => participant.shareAmount),
    ...(proposal.paymentRecords ?? []).map((record) => record.amount)
  ];
  if (moneyValues.some((value) => !isIntegerMoney(value))) {
    violations.push({
      code: "money_not_integer",
      message: "Money values must be finite integer minor units for KRW calculations."
    });
  }

  if (!calculation) {
    violations.push({
      code: "missing_calculation",
      message: "A proposal must have a deterministic calculation result before readiness can be evaluated."
    });
    return violations;
  }

  if (calculation.totalCost !== proposal.totalCost) {
    violations.push({
      code: "total_mismatch",
      message: "The deterministic calculation total must match the proposal total."
    });
  }

  if (sum(Object.values(calculation.totalPaidByParticipant)) !== calculation.totalCost) {
    violations.push({
      code: "paid_total_mismatch",
      message: "Total paid-by amounts must reconcile to the calculated proposal total."
    });
  }

  if (sum(Object.values(calculation.fairShareByParticipant)) !== calculation.totalCost) {
    violations.push({
      code: "share_total_mismatch",
      message: "Participant fair shares must reconcile to the calculated proposal total after rounding."
    });
  }

  if (sum(Object.values(calculation.netBalanceByParticipant)) !== 0) {
    violations.push({
      code: "net_balance_mismatch",
      message: "Participant net balances must sum to zero before settlement instructions are trusted."
    });
  }

  if (calculation.validationWarnings.length > 0) {
    violations.push({
      code: "calculation_warning",
      message: "Calculation warnings must be resolved before payment readiness."
    });
  }

  if (findConflictingPaymentClaims(proposal).length > 0) {
    violations.push({
      code: "conflicting_payment_claims",
      message: "Multiple unresolved payment claims for the same participant relationship need organizer review."
    });
  }

  if (proposal.status === "safe_to_book" && hasUnresolvedPaymentClaims(proposal)) {
    violations.push({
      code: "unresolved_claim_ready",
      message: "A proposal cannot be ready while participant payment claims are unresolved."
    });
  }

  if (proposal.status === "safe_to_book") {
    const unconfirmed = proposal.participants.filter(
      (participant) => participant.status !== "opted_out" && participant.status !== "accepted" && participant.status !== "paid"
    );
    if (unconfirmed.length > 0) {
      violations.push({
        code: "participant_not_confirmed_ready",
        message: "All active participants must accept or be marked paid before a proposal is ready."
      });
    }
  }

  return violations;
}

export function canMarkReadyToPay(proposal: Proposal): boolean {
  return validateProposalFinancialInvariants(proposal).length === 0;
}
