import { distributeRoundingRemainderFairly, normalizeAmount } from "@/lib/domain/money";
import type {
  ParticipantShare,
  SplitCalculationInput,
  SplitCalculationResult,
  SplitParticipantInput
} from "@/lib/domain/proposal-types";

function validateBaseInput(input: SplitCalculationInput): number {
  const totalAmount = normalizeAmount(input.totalAmount);
  if (totalAmount <= 0) {
    throw new Error("Total amount must be greater than zero.");
  }
  if (input.participants.length === 0) {
    throw new Error("At least one participant is required.");
  }
  for (const participant of input.participants) {
    if (!participant.id.trim() || !participant.name.trim()) {
      throw new Error("Each participant must have an id and name.");
    }
    if (participant.weight !== undefined && participant.weight <= 0) {
      throw new Error("Participant weights must be greater than zero.");
    }
    if (participant.percentage !== undefined && participant.percentage < 0) {
      throw new Error("Participant percentages cannot be negative.");
    }
    if (participant.fixedAmount !== undefined && participant.fixedAmount < 0) {
      throw new Error("Fixed amounts cannot be negative.");
    }
  }
  return totalAmount;
}

function sharesFromRaw(totalAmount: number, participants: SplitParticipantInput[], rawAmounts: number[]): ParticipantShare[] {
  const rounded = distributeRoundingRemainderFairly(
    totalAmount,
    participants.map((participant, index) => ({ id: participant.id, rawAmount: rawAmounts[index] }))
  );

  return participants.map((participant) => ({
    participantId: participant.id,
    name: participant.name,
    amount: rounded[participant.id],
    weight: participant.weight,
    percentage: participant.percentage,
    fixedAmount: participant.fixedAmount
  }));
}

function calculateEqual(input: SplitCalculationInput, totalAmount: number): SplitCalculationResult {
  const rawShare = totalAmount / input.participants.length;
  const shares = sharesFromRaw(totalAmount, input.participants, input.participants.map(() => rawShare));
  return {
    totalAmount,
    currency: input.currency,
    method: "equal",
    shares,
    remainder: totalAmount - shares.reduce((sum, share) => sum + share.amount, 0),
    explanation: "Split equally across active participants."
  };
}

function calculateWeighted(input: SplitCalculationInput, totalAmount: number): SplitCalculationResult {
  const totalWeight = input.participants.reduce((sum, participant) => sum + (participant.weight ?? 1), 0);
  if (totalWeight <= 0) {
    throw new Error("Total weight must be greater than zero.");
  }
  const rawAmounts = input.participants.map((participant) => (totalAmount * (participant.weight ?? 1)) / totalWeight);
  const shares = sharesFromRaw(totalAmount, input.participants, rawAmounts);
  return {
    totalAmount,
    currency: input.currency,
    method: "weighted",
    shares,
    remainder: totalAmount - shares.reduce((sum, share) => sum + share.amount, 0),
    explanation: "Split by participant weights."
  };
}

function calculatePercentage(input: SplitCalculationInput, totalAmount: number): SplitCalculationResult {
  const totalPercentage = input.participants.reduce((sum, participant) => sum + (participant.percentage ?? 0), 0);
  if (Math.abs(totalPercentage - 100) > 0.0001) {
    throw new Error("Percentages must add up to 100.");
  }
  const rawAmounts = input.participants.map((participant) => (totalAmount * (participant.percentage ?? 0)) / 100);
  const shares = sharesFromRaw(totalAmount, input.participants, rawAmounts);
  return {
    totalAmount,
    currency: input.currency,
    method: "percentage",
    shares,
    remainder: totalAmount - shares.reduce((sum, share) => sum + share.amount, 0),
    explanation: "Split by explicit participant percentages."
  };
}

function calculateFixed(input: SplitCalculationInput, totalAmount: number): SplitCalculationResult {
  const fixedTotal = input.participants.reduce((sum, participant) => sum + (participant.fixedAmount ?? 0), 0);
  if (fixedTotal > totalAmount) {
    throw new Error("Fixed amounts cannot exceed total amount.");
  }

  const flexible = input.participants.filter((participant) => participant.fixedAmount === undefined);
  if (fixedTotal < totalAmount && flexible.length === 0) {
    throw new Error("Remaining balance requires at least one non-fixed participant.");
  }

  const remaining = totalAmount - fixedTotal;
  const totalFlexibleWeight = flexible.reduce((sum, participant) => sum + (participant.weight ?? 1), 0);
  const rawAmounts = input.participants.map((participant) => {
    if (participant.fixedAmount !== undefined) return participant.fixedAmount;
    return (remaining * (participant.weight ?? 1)) / totalFlexibleWeight;
  });

  const shares = sharesFromRaw(totalAmount, input.participants, rawAmounts);
  return {
    totalAmount,
    currency: input.currency,
    method: "fixed",
    shares,
    remainder: totalAmount - shares.reduce((sum, share) => sum + share.amount, 0),
    explanation: "Fixed participant amounts are honored and the remaining balance is split across the rest."
  };
}

export function calculateSplit(input: SplitCalculationInput): SplitCalculationResult {
  const totalAmount = validateBaseInput(input);
  if (input.method === "weighted") return calculateWeighted(input, totalAmount);
  if (input.method === "percentage") return calculatePercentage(input, totalAmount);
  if (input.method === "fixed") return calculateFixed(input, totalAmount);
  return calculateEqual(input, totalAmount);
}
