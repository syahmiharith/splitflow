import {
  calculateItemizedSplit,
  generateSettlementInstructions,
  type AgreementItem,
  type AgreementParticipant
} from "@/lib/domain/itemized-split-engine";
import { parseExpensePrompt } from "@/lib/parser/expense-parser";
import type { AllocationStrategy, ParsedExpenseDraft, ParserResult } from "@/lib/parser/expense-types";
import type { CostItem, Participant, ParticipantCredit, PaymentRecord, PaymentRecordStatus, Proposal, TimelineEvent } from "@/lib/types";

const defaultNames = ["Syahmi", "Ali", "Sarah", "Daniel", "Aiman", "Amir", "Aisyah", "Mina"];

function now(): string {
  return new Date().toISOString();
}

function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (normalized === "syahmi") return "you";
  return normalized || "participant";
}

function participantFromName(name: string, index: number): Participant {
  return {
    id: slug(name) || `participant-${index + 1}`,
    name: index === 0 && name === "Syahmi" ? "Syahmi" : name,
    status: index === 0 ? "accepted" : "not_sent",
    paymentStatus: index === 0 ? "review" : "remind",
    shareAmount: 0
  };
}

function asAgreementParticipants(participants: Participant[]): AgreementParticipant[] {
  return participants.map((participant) => ({ id: participant.id, name: participant.name }));
}

function asAgreementItems(items: CostItem[]): AgreementItem[] {
  return items.map((item) => ({
    id: item.id,
    label: item.label,
    amount: item.amount,
    paidByParticipantId: item.paidByParticipantId ?? item.paidBy ?? "you",
    includedParticipantIds: item.includedParticipantIds,
    excludedParticipantIds: item.excludedParticipantIds
  }));
}

export function recalculateProposal(proposal: Proposal, timelineText?: string): Proposal {
  const calculation = calculateItemizedSplit({
    currency: proposal.currency,
    participants: asAgreementParticipants(proposal.participants),
    items: asAgreementItems(proposal.costItems)
  });
  const creditAdjustedCalculation = applyCreditsToCalculation(
    calculation,
    (proposal.paymentRecords ?? []).filter((record) => record.kind === "prior_payment" && record.status === "confirmed"),
    proposal.participants
  );

  const timeline: TimelineEvent[] = [
    ...(proposal.timeline ?? []),
    ...(timelineText ? [{ id: crypto.randomUUID(), at: now(), actor: "SplitFlow", text: timelineText }] : [])
  ];

  return {
    ...proposal,
    totalCost: calculation.totalCost,
    participants: proposal.participants.map((participant) => ({
      ...participant,
      shareAmount: creditAdjustedCalculation.fairShareByParticipant[participant.id] ?? 0,
      roleNote:
        creditAdjustedCalculation.totalPaidByParticipant[participant.id] > 0
          ? `Paid ${formatKrw(creditAdjustedCalculation.totalPaidByParticipant[participant.id])}`
          : participant.roleNote
    })),
    calculationResult: creditAdjustedCalculation,
    fairnessNote: creditAdjustedCalculation.auditExplanation.join(" · "),
    recommendation: deriveRecommendation(proposal.status, creditAdjustedCalculation.validationWarnings.length),
    timeline,
    updatedAt: now()
  };
}

export function createProposalFromPrompt(message: string, groupId = "bbq-crew"): { proposal?: Proposal; parserResult: ParserResult } {
  const parserResult = parseExpensePrompt(message);
  if (parserResult.status !== "ready" || !parserResult.draft) return { parserResult };
  return { parserResult, proposal: createProposalFromParsedDraft(parserResult.draft, groupId) };
}

export function createProposalFromPromptWithAllocation(
  message: string,
  groupId = "bbq-crew",
  strategy: Extract<AllocationStrategy, "single_total_equal_items" | "unallocated_remainder">
): { proposal?: Proposal; parserResult: ParserResult } {
  const parserResult = parseExpensePrompt(message);
  if (!parserResult.draft) return { parserResult };
  const draft = resolveAllocationDraft(parserResult.draft, strategy);
  return {
    parserResult: {
      ...parserResult,
      status: "ready",
      mode: draft.mode,
      draft,
      issues: parserResult.issues.filter((issue) => issue.code !== "allocation_required"),
      clarificationQuestions: []
    },
    proposal: createProposalFromParsedDraft(draft, groupId)
  };
}

function resolveAllocationDraft(draft: ParsedExpenseDraft, strategy: Extract<AllocationStrategy, "single_total_equal_items" | "unallocated_remainder">): ParsedExpenseDraft {
  if (!draft.statedTotal) return draft;
  const missing = draft.items.filter((item) => item.amount === undefined);
  if (strategy === "single_total_equal_items" && missing.length > 0) {
    const knownTotal = draft.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
    const allocatable = draft.statedTotal - knownTotal;
    const base = Math.floor(allocatable / missing.length);
    let remainder = allocatable - base * missing.length;
    return {
      ...draft,
      items: draft.items.map((item) => {
        if (item.amount !== undefined) return item;
        const extra = remainder > 0 ? 1 : 0;
        remainder -= extra;
        return { ...item, amount: base + extra };
      }),
      allocationStrategy: "single_total_equal_items",
      assumptions: [...draft.assumptions, `Split ${formatKrw(allocatable)} equally across ${missing.length} missing item amounts.`]
    };
  }
  return {
    ...draft,
    items: [{ id: "shared-expense", label: draft.title, amount: draft.statedTotal, paidByName: draft.payers[0]?.name }],
    exclusions: [],
    allocationStrategy: "unallocated_remainder",
    assumptions: [...draft.assumptions, "Combined ambiguous grouped items into one shared item and removed item-level exclusions."]
  };
}

export function createProposalFromParsedDraft(draft: ParsedExpenseDraft, groupId = "bbq-crew"): Proposal {
  const createdAt = now();
  const participants = draft.participants.map((participant, index) => ({
    id: participant.id,
    name: participant.name,
    status: participant.id === "you" || index === 0 ? ("accepted" as const) : ("not_sent" as const),
    paymentStatus: participant.id === "you" || index === 0 ? ("review" as const) : ("remind" as const),
    shareAmount: 0,
    roleNote: participant.generated ? "Generated participant label" : undefined
  }));
  const participantIdByName = new Map(participants.map((participant) => [participant.name, participant.id]));
  const organizerId = participantIdByName.get("Organizer") ?? participants[0]?.id ?? "you";
  const costItems = buildCostItemsFromDraft(draft, participantIdByName, organizerId);
  const credits = draft.credits.map<ParticipantCredit>((credit) => ({
    fromParticipantId: participantIdByName.get(credit.fromName) ?? slug(credit.fromName),
    toParticipantId: participantIdByName.get(credit.toName) ?? organizerId,
    amount: credit.amount,
    note: credit.note
  }));
  const idSeed = slug(draft.title);
  const paymentRecords = draft.credits.map<PaymentRecord>((credit, index) => ({
    id: `credit-${idSeed}-${index + 1}`,
    groupId,
    proposalId: draft.title === "BBQ Dinner" ? "bbq-dinner" : `proposal-${idSeed}`,
    fromParticipantId: participantIdByName.get(credit.fromName) ?? slug(credit.fromName),
    toParticipantId: participantIdByName.get(credit.toName) ?? organizerId,
    amount: credit.amount,
    currency: "KRW",
    kind: "prior_payment",
    status: "claimed",
    proofType: "note",
    proofNote: credit.note,
    createdAt,
    sourceText: credit.note
  }));
  const proposalId = draft.title === "BBQ Dinner" ? "bbq-dinner" : `proposal-${idSeed}-${Date.now()}`;

  const proposal: Proposal = {
    id: proposalId,
    title: draft.title,
    description: "Parsed from chat input.",
    groupId,
    organizerId,
    organizerName: participants.find((participant) => participant.id === organizerId)?.name ?? "Organizer",
    totalCost: 0,
    currency: draft.currency,
    splitMethod: "mixed_item_based",
    deadline: "2026-05-24T14:30:00.000+09:00",
    cancellationRule: "Participants should accept before the organizer treats the settlement as ready.",
    participants,
    costItems,
    credits,
    paymentRecords: paymentRecords.map((record) => ({ ...record, proposalId })),
    status: "draft",
    isBooked: false,
    createdAt,
    updatedAt: createdAt,
    fairnessNote: "Item costs are split only among eligible participants, then payer reimbursements are netted.",
    recommendation: "Review the deterministic calculation and send the proposal for participant approval.",
    timeline: [{ id: "created", at: createdAt, actor: "Parser", text: "Created draft from prototype-grade natural language parser." }],
    aiExplanation: "The parser extracted structure; deterministic TypeScript calculated all amounts.",
    parserAssumptions: draft.assumptions,
    parserWarnings: draft.warnings.length > 0 ? draft.warnings : paymentRecords.length > 0 ? ["Prior payments are claimed until the organizer confirms them."] : []
  };

  return recalculateProposal(proposal);
}

function buildCostItemsFromDraft(draft: ParsedExpenseDraft, participantIdByName: Map<string, string>, organizerId: string): CostItem[] {
  const firstItem = draft.items[0];
  const fixedPayers = draft.payers.filter((payer) => typeof payer.amount === "number");
  const restPayer = draft.payers.find((payer) => payer.paysRest);

  if (draft.items.length === 1 && firstItem?.amount && fixedPayers.length > 0 && restPayer) {
    const fixedTotal = fixedPayers.reduce((sum, payer) => sum + (payer.amount ?? 0), 0);
    const restAmount = Math.max(0, firstItem.amount - fixedTotal);
    return [
      ...fixedPayers.map((payer) => itemFromDraft(firstItem, payer.amount ?? 0, participantIdByName.get(payer.name) ?? slug(payer.name), participantIdByName, slug(payer.name))),
      ...(restAmount > 0 ? [itemFromDraft(firstItem, restAmount, participantIdByName.get(restPayer.name) ?? organizerId, participantIdByName, slug(restPayer.name))] : [])
    ];
  }

  return draft.items.map((item) => itemFromDraft(item, item.amount ?? draft.statedTotal ?? 0, participantIdByName.get(item.paidByName ?? "") ?? organizerId, participantIdByName));
}

function itemFromDraft(item: ParsedExpenseDraft["items"][number], amount: number, paidByParticipantId: string, participantIdByName: Map<string, string>, idSuffix?: string): CostItem {
  return {
    id: idSuffix ? `${item.id}-${idSuffix}` : item.id,
    label: item.label,
    amount,
    paidByParticipantId,
    includedParticipantIds: item.includedParticipantNames?.map((name) => participantIdByName.get(name) ?? slug(name)),
    excludedParticipantIds: item.excludedParticipantNames?.map((name) => participantIdByName.get(name) ?? slug(name))
  };
}

function applyCreditsToCalculation(
  calculation: ReturnType<typeof calculateItemizedSplit>,
  credits: Array<Pick<PaymentRecord, "fromParticipantId" | "toParticipantId" | "amount" | "proofNote">>,
  participants: Participant[]
): ReturnType<typeof calculateItemizedSplit> {
  if (credits.length === 0) return calculation;
  const netBalanceByParticipant = { ...calculation.netBalanceByParticipant };
  const auditExplanation = [...calculation.auditExplanation];

  for (const credit of credits) {
    netBalanceByParticipant[credit.fromParticipantId] = (netBalanceByParticipant[credit.fromParticipantId] ?? 0) + credit.amount;
    netBalanceByParticipant[credit.toParticipantId] = (netBalanceByParticipant[credit.toParticipantId] ?? 0) - credit.amount;
    auditExplanation.push(credit.proofNote ?? `Confirmed prior payment: ${formatKrw(credit.amount)}.`);
  }

  return {
    ...calculation,
    netBalanceByParticipant,
    settlementInstructions: generateSettlementInstructions(
      participants.map((participant) => ({ id: participant.id, name: participant.name })),
      netBalanceByParticipant
    ),
    auditExplanation
  };
}

export function updatePaymentRecordStatus(proposal: Proposal, recordId: string, status: PaymentRecordStatus, actor = "Organizer"): Proposal {
  const records = (proposal.paymentRecords ?? []).map((record) =>
    record.id === recordId
      ? {
          ...record,
          status,
          confirmedAt: status === "confirmed" ? now() : record.confirmedAt,
          confirmedBy: status === "confirmed" ? actor : record.confirmedBy
        }
      : record
  );
  return recalculateProposal(
    {
      ...proposal,
      paymentRecords: records,
      timeline: [
        ...(proposal.timeline ?? []),
        {
          id: crypto.randomUUID(),
          at: now(),
          actor,
          text: `Marked credit ${recordId} as ${status}.`
        }
      ]
    },
    `Updated proof-aware credit ledger: ${recordId} is ${status}.`
  );
}

export function createSettlementLedgerLines(proposal: Proposal): string[] {
  const calculation = proposal.calculationResult;
  const participantName = new Map(proposal.participants.map((participant) => [participant.id, participant.name]));
  const records = proposal.paymentRecords ?? [];
  const lines = ["Settlement ledger"];
  for (const participant of proposal.participants) {
    const fairShare = calculation?.fairShareByParticipant[participant.id] ?? participant.shareAmount;
    const claimed = records.filter((record) => record.fromParticipantId === participant.id && record.status === "claimed").reduce((sum, record) => sum + record.amount, 0);
    const confirmed = records.filter((record) => record.fromParticipantId === participant.id && record.status === "confirmed").reduce((sum, record) => sum + record.amount, 0);
    const net = calculation?.netBalanceByParticipant[participant.id] ?? 0;
    lines.push(`${participant.name}: fair share ${formatKrw(fairShare)}, claimed paid ${formatKrw(claimed)}, confirmed paid ${formatKrw(confirmed)}, remaining net ${formatKrw(net)}.`);
  }
  for (const record of records) {
    lines.push(
      `${participantName.get(record.fromParticipantId) ?? record.fromParticipantId} claimed ${formatKrw(record.amount)} to ${participantName.get(record.toParticipantId) ?? record.toParticipantId}: ${record.status}${record.proofNote ? ` (${record.proofNote})` : ""}.`
    );
  }
  return lines;
}

export function createBbqProposalFromPrompt(message: string): Proposal | undefined {
  if (!/bbq|barbecue/i.test(message)) return undefined;

  const countMatch = message.match(/for\s+(\d+)/i);
  const count = countMatch ? Number(countMatch[1]) : 8;
  const names = defaultNames.slice(0, Math.max(1, count));
  const participants = names.map(participantFromName);
  const byId = new Map(participants.map((participant) => [participant.name.toLowerCase(), participant.id]));
  const syahmiId = byId.get("syahmi") ?? "you";
  const aliId = byId.get("ali") ?? "ali";
  const sarahId = byId.get("sarah") ?? "sarah";
  const danielId = byId.get("daniel") ?? "daniel";

  const items: CostItem[] = [
    {
      id: "meat",
      label: "Meat",
      amount: findAmountBeforeLabel(message, "meat") ?? 64000,
      paidBy: "Syahmi",
      paidByParticipantId: syahmiId,
      excludedParticipantIds: /daniel.+(?:did not|didn't|didnt).+(?:beef|meat)|(?:beef|meat).+daniel/i.test(message) ? [danielId] : undefined
    },
    {
      id: "drinks",
      label: "Drinks",
      amount: findAmountBeforeLabel(message, "drinks") ?? 24000,
      paidBy: "Ali",
      paidByParticipantId: aliId
    },
    {
      id: "charcoal",
      label: "Charcoal",
      amount: findAmountBeforeLabel(message, "charcoal") ?? 10000,
      paidBy: "Sarah",
      paidByParticipantId: sarahId
    },
    {
      id: "sides",
      label: "Sides",
      amount: findAmountBeforeLabel(message, "sides") ?? 30000,
      paidBy: "Syahmi",
      paidByParticipantId: syahmiId
    }
  ];

  const createdAt = now();
  const proposal: Proposal = {
    id: "bbq-dinner",
    title: "BBQ Dinner",
    description: "Itemized BBQ split with payer reimbursement and item exclusions.",
    groupId: "bbq-crew",
    organizerId: syahmiId,
    organizerName: "Syahmi",
    totalCost: 0,
    currency: "KRW",
    splitMethod: "mixed_item_based",
    deadline: "2026-05-24T14:30:00.000+09:00",
    cancellationRule: "Participants should accept before the organizer treats the settlement as ready.",
    participants,
    costItems: items,
    status: "draft",
    isBooked: false,
    createdAt,
    updatedAt: createdAt,
    fairnessNote: "Item costs are split only among eligible participants, then payer reimbursements are netted.",
    recommendation: "Review the deterministic calculation and send the proposal for participant approval.",
    timeline: [{ id: "created", at: createdAt, actor: "Organizer", text: "Created draft from chat input." }],
    aiExplanation: "AI drafted the proposal structure; deterministic TypeScript calculated all amounts."
  };

  return recalculateProposal(proposal);
}

export function applyPrototypeAdjustment(proposal: Proposal, prompt: string): { proposal: Proposal; changed: boolean; before: Record<string, number> } {
  const before = Object.fromEntries(proposal.participants.map((participant) => [participant.id, participant.shareAmount]));
  let changed = false;
  let next = proposal;

  if (isDanielBeefExclusion(prompt)) {
    next = updateItemExclusion(next, "meat", "daniel", true);
    changed = true;
  }

  if (/ali.+only.+drinks|only.+drinks.+ali/i.test(prompt)) {
    next = {
      ...next,
      costItems: next.costItems.map((item) =>
        item.id === "drinks"
          ? { ...item, includedParticipantIds: ["ali"] }
          : { ...item, excludedParticipantIds: Array.from(new Set([...(item.excludedParticipantIds ?? []), "ali"])) }
      )
    };
    changed = true;
  }

  if (/meat.+(?:only\s+)?among\s+6|split meat only among 6/i.test(prompt)) {
    const eligible = next.participants.filter((participant) => participant.id !== "daniel").slice(0, 6).map((participant) => participant.id);
    next = { ...next, costItems: next.costItems.map((item) => (item.id === "meat" ? { ...item, includedParticipantIds: eligible } : item)) };
    changed = true;
  }

  if (/sarah.+not pay.+charcoal|sarah.+brought.+charcoal/i.test(prompt)) {
    next = updateItemExclusion(next, "charcoal", "sarah", true);
    changed = true;
  }

  if (!changed) return { proposal, changed, before };

  const recalculated = recalculateProposal(
    {
      ...next,
      status: next.status === "draft" ? "draft" : "needs_reconfirmation"
    },
    `Applied adjustment: ${prompt}`
  );
  return { proposal: recalculated, changed, before };
}

function isDanielBeefExclusion(prompt: string): boolean {
  return /daniel.+(?:did not|didn't|didnt).+(?:beef|meat)|(?:beef|meat).+daniel|(?:^|\b)i\s+(?:did not|didn't|didnt)\s+eat\s+(?:beef|meat)/i.test(prompt);
}

export function loadTripDemoProposal(): Proposal {
  const createdAt = now();
  const participants = ["Syahmi", "Amir", "Aisyah", "Daniel"].map(participantFromName);
  const proposal: Proposal = {
    id: `trip-${Date.now()}`,
    title: "Weekend Trip",
    description: "Simple trip demo with equal lodging and transport split.",
    groupId: "trip",
    organizerId: "you",
    organizerName: "Syahmi",
    totalCost: 0,
    currency: "KRW",
    splitMethod: "mixed_item_based",
    deadline: "2026-05-30T14:30:00.000+09:00",
    cancellationRule: "Confirm before booking.",
    participants,
    costItems: [
      { id: "lodging", label: "Lodging", amount: 280000, paidBy: "Syahmi", paidByParticipantId: "you" },
      { id: "transport", label: "Transport", amount: 80000, paidBy: "Amir", paidByParticipantId: "amir" }
    ],
    status: "draft",
    isBooked: false,
    createdAt,
    updatedAt: createdAt,
    fairnessNote: "",
    recommendation: "",
    timeline: [{ id: "created", at: createdAt, actor: "Demo", text: "Loaded trip demo." }]
  };
  return recalculateProposal(proposal);
}

export function loadSubscriptionDemoProposal(): Proposal {
  const createdAt = now();
  const participants = ["Syahmi", "Ali", "Sarah", "Daniel", "Aiman"].map(participantFromName);
  const proposal: Proposal = {
    id: `subscription-${Date.now()}`,
    title: "Netflix Family",
    description: "Subscription demo with one payer and equal member split.",
    groupId: "subscription",
    organizerId: "you",
    organizerName: "Syahmi",
    totalCost: 0,
    currency: "KRW",
    splitMethod: "mixed_item_based",
    deadline: "2026-06-01T14:30:00.000+09:00",
    cancellationRule: "Members confirm each billing cycle.",
    participants,
    costItems: [{ id: "subscription", label: "Monthly subscription", amount: 17000, paidBy: "Syahmi", paidByParticipantId: "you" }],
    status: "draft",
    isBooked: false,
    createdAt,
    updatedAt: createdAt,
    fairnessNote: "",
    recommendation: "",
    timeline: [{ id: "created", at: createdAt, actor: "Demo", text: "Loaded subscription demo." }]
  };
  return recalculateProposal(proposal);
}

function findAmountBeforeLabel(message: string, label: string): number | undefined {
  const pattern = new RegExp(`(?:₩|krw\\s*)?(\\d[\\d,]*)\\s+${label}`, "i");
  const match = message.match(pattern);
  return match ? Number(match[1].replace(/,/g, "")) : undefined;
}

function updateItemExclusion(proposal: Proposal, itemId: string, participantId: string, excluded: boolean): Proposal {
  return {
    ...proposal,
    costItems: proposal.costItems.map((item) => {
      if (item.id !== itemId) return item;
      const current = new Set(item.excludedParticipantIds ?? []);
      if (excluded) current.add(participantId);
      else current.delete(participantId);
      return { ...item, excludedParticipantIds: Array.from(current), includedParticipantIds: undefined };
    })
  };
}

function deriveRecommendation(status: Proposal["status"], warningCount: number): string {
  if (warningCount > 0) return "Resolve validation warnings before sending this proposal.";
  if (status === "changes_requested") return "Review the change request and recalculate before asking participants to reconfirm.";
  if (status === "needs_reconfirmation") return "Amounts changed after responses; request reconfirmation before payment.";
  if (status === "safe_to_book") return "All active participants accepted. Settlement is ready to proceed.";
  return "Send the proposal when the organizer is comfortable with the assumptions.";
}

function formatKrw(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}
