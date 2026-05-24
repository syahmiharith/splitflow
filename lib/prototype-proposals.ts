import {
  calculateItemizedSplit,
  generateSettlementInstructions,
  type AgreementItem,
  type AgreementParticipant
} from "@/lib/domain/itemized-split-engine";
import { parseExpensePrompt } from "@/lib/parser/expense-parser";
import type { AllocationStrategy, ParsedExpenseDraft, ParserResult } from "@/lib/parser/expense-types";
import type { CostItem, Participant, ParticipantCredit, PaymentRecord, PaymentRecordStatus, Proposal, TimelineEvent } from "@/lib/types";

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

export function createProposalFromPrompt(message: string, groupId = "han-river-bbq"): { proposal?: Proposal; parserResult: ParserResult } {
  const parserResult = parseExpensePrompt(message);
  if (parserResult.status !== "ready" || !parserResult.draft) return { parserResult };
  return { parserResult, proposal: createProposalFromParsedDraft(parserResult.draft, groupId) };
}

export function createProposalFromPromptWithAllocation(
  message: string,
  groupId = "han-river-bbq",
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

export function createProposalFromParsedDraft(draft: ParsedExpenseDraft, groupId = "han-river-bbq"): Proposal {
  const createdAt = now();
  const participants = draft.participants.map((participant, index) => ({
    id: participant.id,
    name: participant.name,
    status: participant.id === "you" || index === 0 ? ("accepted" as const) : ("not_sent" as const),
    paymentStatus: participant.id === "you" || index === 0 ? ("review" as const) : ("remind" as const),
    shareAmount: 0,
    roleNote:
      participant.id === "ali" && /Ali.+(?:above|over|exceeds?)\s*(?:₩\s*)?20,?000/i.test(draft.rawInput)
        ? "Risk note: may request change if share exceeds ₩20,000."
        : participant.generated
          ? "Generated participant label"
          : undefined
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
    proposalId: `proposal-${idSeed}`,
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
  const proposalId = `proposal-${idSeed}-${Date.now()}`;

  const proposal: Proposal = {
    id: proposalId,
    version: 1,
    revisionHistory: [],
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
    const fairShare = calculation?.fairShareByParticipant?.[participant.id] ?? participant.shareAmount;
    const claimed = records.filter((record) => record.fromParticipantId === participant.id && record.status === "claimed").reduce((sum, record) => sum + record.amount, 0);
    const confirmed = records.filter((record) => record.fromParticipantId === participant.id && record.status === "confirmed").reduce((sum, record) => sum + record.amount, 0);
    const net = calculation?.netBalanceByParticipant?.[participant.id] ?? 0;
    lines.push(`${participant.name}: fair share ${formatKrw(fairShare)}, claimed payment ${formatKrw(claimed)}, organizer-confirmed payment ${formatKrw(confirmed)} (confirmed paid ${formatKrw(confirmed)}), remaining net ${formatKrw(net)}.`);
  }
  for (const record of records) {
    lines.push(
      `${participantName.get(record.fromParticipantId) ?? record.fromParticipantId} claimed payment ${formatKrw(record.amount)} to ${participantName.get(record.toParticipantId) ?? record.toParticipantId}: ${record.status}${record.proofNote ? ` (${record.proofNote})` : ""}.`
    );
  }
  return lines;
}

export function applyPrototypeAdjustment(proposal: Proposal, prompt: string): { proposal: Proposal; changed: boolean; before: Record<string, number> } {
  const before = Object.fromEntries(proposal.participants.map((participant) => [participant.id, participant.shareAmount]));
  let changed = false;
  let next = proposal;

  if (/alex.+(?:only.+saturday|join.+saturday|staying.+saturday)|(?:only.+saturday|join.+saturday|staying.+saturday).+alex/i.test(prompt)) {
    next = updateItemExclusion(next, "friday-airbnb", "alex", true);
    changed = true;
  }
  if (/daniel.+(?:does not|doesn't|did not|didn't|no).+(?:beef|meat)|(?:beef|meat).+exclude.+daniel|daniel.+exclude.+(?:beef|meat)/i.test(prompt)) {
    next = updateItemExclusion(next, "meat", "daniel", true);
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

export function loadTripDemoProposal(): Proposal {
  return createHanRiverBbqProposal("han-river-bbq", "han-river-bbq-proposal");
}

export function createHanRiverBbqProposal(groupId = "han-river-bbq", id = "han-river-bbq-proposal"): Proposal {
  const createdAt = now();
  const participants = ["Syahmi", "Ali", "Sarah", "Daniel", "Mira", "Hakim", "Adam", "Minji"].map(participantFromName).map((participant) => {
    if (participant.id === "ali") return { ...participant, roleNote: "Risk note: may request change if share exceeds ₩20,000." };
    if (participant.id === "sarah") return { ...participant, roleNote: "Claimed ₩10,000 sent; organizer must confirm before counting it as paid." };
    if (participant.id === "daniel") return { ...participant, roleNote: "Excluded from meat because he does not eat beef." };
    return participant;
  });
  const proposal: Proposal = {
    id,
    version: 1,
    revisionHistory: [],
    title: "Han River BBQ Proposal",
    description: "Agreement before the organizer fronts the BBQ cost.",
    groupId,
    organizerId: "you",
    organizerName: "Syahmi",
    totalCost: 0,
    currency: "KRW",
    splitMethod: "mixed_item_based",
    deadline: "2026-05-24T18:00:00.000+09:00",
    cancellationRule: "Participants should review exclusions and claimed payments before Syahmi buys the BBQ supplies.",
    participants,
    costItems: [
      { id: "meat", label: "Meat", amount: 80000, paidBy: "Syahmi", paidByParticipantId: "you", excludedParticipantIds: ["daniel"] },
      { id: "drinks", label: "Drinks", amount: 20000, paidBy: "Syahmi", paidByParticipantId: "you" },
      { id: "charcoal", label: "Charcoal", amount: 10000, paidBy: "Syahmi", paidByParticipantId: "you" },
      { id: "sides", label: "Sides", amount: 18000, paidBy: "Syahmi", paidByParticipantId: "you" }
    ],
    paymentRecords: [
      {
        id: "sarah-bbq-claimed-payment",
        groupId,
        proposalId: id,
        fromParticipantId: "sarah",
        toParticipantId: "you",
        amount: 10000,
        currency: "KRW",
        kind: "prior_payment",
        status: "claimed",
        proofType: "note",
        proofNote: "Sarah says she already sent ₩10,000. Organizer confirmation is still required.",
        createdAt,
        sourceText: "Sarah already sent me ₩10,000, but I need to confirm it before counting it as paid."
      }
    ],
    status: "draft",
    isBooked: false,
    createdAt,
    updatedAt: createdAt,
    fairnessNote: "Daniel is excluded from meat. Sarah's claimed payment is tracked but not counted as confirmed money. Ali has a share threshold risk note.",
    recommendation: "Review the deterministic math, confirm Sarah's claimed payment, then send the proposal for agreement before buying.",
    timeline: [{ id: "created", at: createdAt, actor: "SplitFlow", text: "Built a BBQ agreement proposal from messy organizer context." }],
    aiExplanation: "AI structures the agreement workflow; deterministic TypeScript calculates itemized shares and settlement readiness.",
    parserAssumptions: ["Agreement must be collected before the organizer fronts the BBQ cost."],
    parserWarnings: ["Sarah's payment is claimed only. No bank verification in prototype; it is not counted until the organizer confirms it."]
  };
  return recalculateProposal(proposal);
}

export function createJejuTripProposal(groupId = "han-river-bbq", id = "jeju-airbnb-trip"): Proposal {
  const createdAt = now();
  const participants = ["Syahmi", "Mina", "Daniel", "Alex", "Sarah", "Yuna"].map(participantFromName).map((participant) => {
    if (participant.id === "mina") return { ...participant, roleNote: "Sharing a room with Daniel" };
    if (participant.id === "daniel") return { ...participant, roleNote: "Sharing a room with Mina" };
    if (participant.id === "alex") return { ...participant, roleNote: "Only staying Saturday night" };
    return participant;
  });
  const proposal: Proposal = {
    id,
    version: 1,
    revisionHistory: [],
    title: "Jeju Airbnb Trip Split",
    description: "Airbnb booking split where the organizer needs friend confirmations before paying the host.",
    groupId,
    organizerId: "you",
    organizerName: "Syahmi",
    totalCost: 0,
    currency: "KRW",
    splitMethod: "mixed_item_based",
    deadline: "2026-05-25T20:00:00.000+09:00",
    cancellationRule: "Friends should tap I'm In before Syahmi books. If someone leaves, changed amounts need another check.",
    participants,
    costItems: [
      { id: "friday-airbnb", label: "Friday night Airbnb", amount: 210000, paidBy: "Syahmi", paidByParticipantId: "you", excludedParticipantIds: ["alex"] },
      { id: "saturday-airbnb", label: "Saturday night Airbnb", amount: 210000, paidBy: "Syahmi", paidByParticipantId: "you" },
      { id: "cleaning-fee", label: "Cleaning fee", amount: 60000, paidBy: "Syahmi", paidByParticipantId: "you" },
      { id: "van-deposit", label: "Van deposit", amount: 90000, paidBy: "Sarah", paidByParticipantId: "sarah" }
    ],
    status: "draft",
    isBooked: false,
    createdAt,
    updatedAt: createdAt,
    fairnessNote: "Alex is not included in Friday night because he only joins on Saturday.",
    recommendation: "Send this trip split to friends and wait for confirmations before booking.",
    timeline: [{ id: "created", at: createdAt, actor: "SplitFlow", text: "Built a trip split from messy booking details." }],
    aiExplanation: "AI structures the trip details; deterministic TypeScript calculates shares and booking readiness."
  };
  return recalculateProposal(proposal);
}

export function loadSubscriptionDemoProposal(): Proposal {
  const createdAt = now();
  const participants = ["Syahmi", "Ali", "Sarah", "Daniel", "Aiman"].map(participantFromName);
  const proposal: Proposal = {
    id: `subscription-${Date.now()}`,
    version: 1,
    revisionHistory: [],
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
