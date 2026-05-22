export type AgreementParticipant = {
  id: string;
  name: string;
};

export type AgreementItem = {
  id: string;
  label: string;
  amount: number;
  paidByParticipantId: string;
  includedParticipantIds?: string[];
  excludedParticipantIds?: string[];
};

export type ItemizedSplitInput = {
  currency: "KRW";
  participants: AgreementParticipant[];
  items: AgreementItem[];
};

export type ItemizedBreakdownRow = {
  itemId: string;
  label: string;
  amount: number;
  paidByParticipantId: string;
  eligibleParticipantIds: string[];
  shareByParticipant: Record<string, number>;
  auditText: string;
};

export type RoundingAdjustment = {
  itemId: string;
  participantId: string;
  amount: number;
  reason: string;
};

export type SettlementInstruction = {
  fromParticipantId: string;
  toParticipantId: string;
  amount: number;
  text: string;
};

export type ItemizedSplitResult = {
  totalCost: number;
  totalPaidByParticipant: Record<string, number>;
  fairShareByParticipant: Record<string, number>;
  netBalanceByParticipant: Record<string, number>;
  settlementInstructions: SettlementInstruction[];
  itemizedBreakdown: ItemizedBreakdownRow[];
  roundingAdjustments: RoundingAdjustment[];
  validationWarnings: string[];
  auditExplanation: string[];
};

function formatKrw(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

function assertParticipant(input: ItemizedSplitInput, participantId: string, context: string): void {
  if (!input.participants.some((participant) => participant.id === participantId)) {
    throw new Error(`${context} references an unknown participant.`);
  }
}

function emptyParticipantAmounts(participants: AgreementParticipant[]): Record<string, number> {
  return Object.fromEntries(participants.map((participant) => [participant.id, 0]));
}

function eligibleParticipants(input: ItemizedSplitInput, item: AgreementItem): AgreementParticipant[] {
  if (item.includedParticipantIds) {
    item.includedParticipantIds.forEach((participantId) => assertParticipant(input, participantId, item.label));
  }
  if (item.excludedParticipantIds) {
    item.excludedParticipantIds.forEach((participantId) => assertParticipant(input, participantId, item.label));
  }

  const included = item.includedParticipantIds
    ? input.participants.filter((participant) => item.includedParticipantIds?.includes(participant.id))
    : input.participants;
  const excluded = new Set(item.excludedParticipantIds ?? []);
  return included.filter((participant) => !excluded.has(participant.id));
}

function distributeEqual(amount: number, participantIds: string[], itemId: string): {
  shareByParticipant: Record<string, number>;
  adjustments: RoundingAdjustment[];
} {
  const base = Math.floor(amount / participantIds.length);
  let remainder = amount - base * participantIds.length;
  const shareByParticipant = Object.fromEntries(participantIds.map((participantId) => [participantId, base]));
  const adjustments: RoundingAdjustment[] = [];

  for (const participantId of participantIds) {
    if (remainder <= 0) break;
    shareByParticipant[participantId] += 1;
    adjustments.push({
      itemId,
      participantId,
      amount: 1,
      reason: "Assigned one minor unit from the rounding remainder in participant order."
    });
    remainder -= 1;
  }

  return { shareByParticipant, adjustments };
}

export function generateSettlementInstructions(
  participants: AgreementParticipant[],
  netBalanceByParticipant: Record<string, number>
): SettlementInstruction[] {
  const names = new Map(participants.map((participant) => [participant.id, participant.name]));
  const creditors = participants
    .map((participant) => ({ participantId: participant.id, amount: netBalanceByParticipant[participant.id] ?? 0 }))
    .filter((entry) => entry.amount > 0);
  const debtors = participants
    .map((participant) => ({ participantId: participant.id, amount: -(netBalanceByParticipant[participant.id] ?? 0) }))
    .filter((entry) => entry.amount > 0);

  const instructions: SettlementInstruction[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      instructions.push({
        fromParticipantId: debtor.participantId,
        toParticipantId: creditor.participantId,
        amount,
        text: `${names.get(debtor.participantId) ?? debtor.participantId} pays ${names.get(creditor.participantId) ?? creditor.participantId} ${formatKrw(amount)}`
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;
    if (debtor.amount === 0) debtorIndex += 1;
    if (creditor.amount === 0) creditorIndex += 1;
  }

  return instructions;
}

export function calculateItemizedSplit(input: ItemizedSplitInput): ItemizedSplitResult {
  if (input.participants.length === 0) {
    throw new Error("At least one participant is required.");
  }
  if (input.items.length === 0) {
    throw new Error("At least one item is required.");
  }

  const participantNames = new Map(input.participants.map((participant) => [participant.id, participant.name]));
  const totalPaidByParticipant = emptyParticipantAmounts(input.participants);
  const fairShareByParticipant = emptyParticipantAmounts(input.participants);
  const itemizedBreakdown: ItemizedBreakdownRow[] = [];
  const roundingAdjustments: RoundingAdjustment[] = [];
  const validationWarnings: string[] = [];
  const auditExplanation: string[] = [];

  for (const item of input.items) {
    if (item.amount <= 0) {
      throw new Error(`${item.label} must have a positive amount.`);
    }
    assertParticipant(input, item.paidByParticipantId, item.label);

    const eligible = eligibleParticipants(input, item);
    if (eligible.length === 0) {
      throw new Error(`${item.label} has no eligible participants.`);
    }

    totalPaidByParticipant[item.paidByParticipantId] += item.amount;
    const eligibleIds = eligible.map((participant) => participant.id);
    const { shareByParticipant, adjustments } = distributeEqual(item.amount, eligibleIds, item.id);
    roundingAdjustments.push(...adjustments);

    for (const [participantId, share] of Object.entries(shareByParticipant)) {
      fairShareByParticipant[participantId] += share;
    }

    const excludedNames = (item.excludedParticipantIds ?? []).map((participantId) => participantNames.get(participantId) ?? participantId);
    const baseText = `${item.label}: ${formatKrw(item.amount)} ÷ ${eligible.length} = ${formatKrw(Math.round(item.amount / eligible.length))}`;
    const auditText = excludedNames.length > 0 ? `${baseText} (${excludedNames.join(", ")} excluded)` : baseText;
    auditExplanation.push(auditText);
    itemizedBreakdown.push({
      itemId: item.id,
      label: item.label,
      amount: item.amount,
      paidByParticipantId: item.paidByParticipantId,
      eligibleParticipantIds: eligibleIds,
      shareByParticipant,
      auditText
    });
  }

  const totalCost = input.items.reduce((sum, item) => sum + item.amount, 0);
  const totalPaid = Object.values(totalPaidByParticipant).reduce((sum, amount) => sum + amount, 0);
  const totalFairShare = Object.values(fairShareByParticipant).reduce((sum, amount) => sum + amount, 0);

  if (totalPaid !== totalCost) validationWarnings.push("Total paid does not reconcile with total cost.");
  if (totalFairShare !== totalCost) validationWarnings.push("Fair shares do not reconcile with total cost.");

  const netBalanceByParticipant = Object.fromEntries(
    input.participants.map((participant) => [
      participant.id,
      (totalPaidByParticipant[participant.id] ?? 0) - (fairShareByParticipant[participant.id] ?? 0)
    ])
  );
  const netSum = Object.values(netBalanceByParticipant).reduce((sum, amount) => sum + amount, 0);
  if (netSum !== 0) validationWarnings.push(`Net balances sum to ${netSum}; this must be resolved before settlement.`);

  return {
    totalCost,
    totalPaidByParticipant,
    fairShareByParticipant,
    netBalanceByParticipant,
    settlementInstructions: generateSettlementInstructions(input.participants, netBalanceByParticipant),
    itemizedBreakdown,
    roundingAdjustments,
    validationWarnings,
    auditExplanation
  };
}
