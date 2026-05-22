import type {
  ParsedCredit,
  ParsedExclusion,
  ParsedExpenseDraft,
  ParsedExpenseIntent,
  ParsedExpenseItem,
  ParsedParticipant,
  ParsedPayer
} from "@/lib/parser/expense-types";

const stopNames = new Set(["BBQ", "KRW", "Total", "Split", "Round", "House", "Trip", "Movie", "Dinner", "Groceries"]);
const knownItemAliases: Record<string, string[]> = {
  meat: ["beef", "meat", "chicken"],
  drinks: ["drink", "drinks", "drank"],
  snacks: ["snack", "snacks"],
  tickets: ["ticket", "tickets"],
  charcoal: ["charcoal"],
  sides: ["side", "sides"],
  groceries: ["groceries", "grocery"],
  delivery: ["delivery"],
  dessert: ["dessert"],
  rice: ["rice"],
  gift: ["gift"]
};

type MoneyMatch = {
  amount: number;
  raw: string;
  index: number;
  end: number;
  hasCurrencySignal: boolean;
};

export function slug(value: string): string {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  if (["i", "me", "organizer", "you"].includes(normalized)) return "you";
  return normalized || "participant";
}

export function formatKrw(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}

export function normalizeExpenseDraft(input: string): ParsedExpenseDraft {
  const cleaned = input.replace(/[’]/g, "'").trim();
  const intent = classifyExpenseIntent(cleaned);
  const participantCount = extractParticipantCount(cleaned);
  const rawNames = excludeNonParticipants(extractNames(cleaned), cleaned, intent);
  const payers = extractPayers(cleaned);
  const exclusions = extractExclusions(cleaned);
  const credits = extractCredits(cleaned);
  const names = mergeParticipantNames(rawNames, payers, exclusions, credits);
  const assumptions: string[] = [];

  const participantNames = buildParticipantNames(names, participantCount, assumptions);
  const participants = participantNames.map<ParsedParticipant>((name, index) => ({
    id: slug(name) || `participant-${index + 1}`,
    name,
    generated: /^Participant \d+$/.test(name)
  }));

  const moneyMatches = findMoneyMatches(cleaned);
  const statedTotal = extractStatedTotal(cleaned, moneyMatches);
  let items = extractItems(cleaned, payers);
  if (items.length === 0 && statedTotal) {
    items = [{ id: slug(defaultItemLabel(intent)), label: defaultItemLabel(intent), amount: statedTotal, paidByName: inferDefaultPayer(payers), sourceText: "total-only prompt" }];
    assumptions.push(`Created one ${defaultItemLabel(intent)} item from the stated total.`);
  }

  items = applyParticipationRules(items, exclusions, participants);
  if (!hasExplicitCurrency(cleaned)) {
    assumptions.push("Assumed KRW because this prototype currently supports KRW splits.");
  }

  return {
    rawInput: input,
    intent,
    title: titleForIntent(intent, cleaned),
    currency: "KRW",
    statedTotal,
    participantCount,
    participants,
    items,
    payers,
    exclusions,
    credits,
    assumptions,
    warnings: []
  };
}

function excludeNonParticipants(names: string[], input: string, intent: ParsedExpenseIntent): string[] {
  if (intent !== "gift") return names;
  const recipient = input.match(/\bgift\s+for\s+([A-Z][a-z]+)/i);
  if (!recipient) return names;
  return names.filter((name) => name !== recipient[1]);
}

export function classifyExpenseIntent(input: string): ParsedExpenseIntent {
  if (/bbq|barbecue|dinner|chicken|rice|dessert|drinks|groceries/i.test(input)) return "food";
  if (/trip|travel|airbnb|hotel|busan|jeju/i.test(input)) return "travel";
  if (/movie|ticket|snack/i.test(input)) return "movie";
  if (/gift|minji|present/i.test(input)) return "gift";
  if (/house|delivery|bill|utilities/i.test(input)) return "household";
  return "shared_expense";
}

function titleForIntent(intent: ParsedExpenseIntent, input: string): string {
  if (/bbq|barbecue/i.test(input)) return "BBQ Dinner";
  if (/movie/i.test(input)) return "Movie Night";
  if (/gift/i.test(input)) return "Group Gift";
  if (/trip/i.test(input)) return "Trip Dinner";
  if (/house/i.test(input)) return "House Dinner";
  if (/dinner/i.test(input)) return "Dinner";
  return intent === "shared_expense" ? "Shared Expense" : `${capitalize(intent)} Split`;
}

function defaultItemLabel(intent: ParsedExpenseIntent): string {
  if (intent === "food") return "Dinner";
  if (intent === "movie") return "Movie night";
  if (intent === "gift") return "Group gift";
  if (intent === "travel") return "Trip expense";
  if (intent === "household") return "House expense";
  return "Shared expense";
}

function extractParticipantCount(input: string): number | undefined {
  const match = input.match(/(?:for|between|among|joined|split between)?\s*(\d+)\s+(?:people|participants|pax|friends)\b/i);
  return match ? Number(match[1]) : undefined;
}

function extractNames(input: string): string[] {
  const names = new Set<string>();
  for (const match of input.matchAll(/\b([A-Z][a-z]+)\b/g)) {
    const name = match[1];
    if (!stopNames.has(name)) names.add(name);
  }
  if (/\b(I|me|my)\b/i.test(input)) names.add("Organizer");
  return Array.from(names);
}

function mergeParticipantNames(names: string[], payers: ParsedPayer[], exclusions: ParsedExclusion[], credits: ParsedCredit[]): string[] {
  const merged = new Set(names);
  for (const payer of payers) merged.add(payer.name);
  for (const exclusion of exclusions) merged.add(exclusion.participantName);
  for (const credit of credits) {
    merged.add(credit.fromName);
    merged.add(credit.toName);
  }
  if (merged.size === 0) merged.add("Organizer");
  return Array.from(merged).sort((a, b) => (a === "Organizer" ? -1 : b === "Organizer" ? 1 : a.localeCompare(b)));
}

function buildParticipantNames(names: string[], participantCount: number | undefined, assumptions: string[]): string[] {
  const result = [...names];
  if (participantCount && participantCount > result.length) {
    let index = result.length + 1;
    while (result.length < participantCount) {
      result.push(`Participant ${index}`);
      index += 1;
    }
    assumptions.push("Some participant names were generated because only the count was provided.");
  }
  return result;
}

function findMoneyMatches(input: string): MoneyMatch[] {
  const matches: MoneyMatch[] = [];
  const pattern = /(?:₩\s*)?(\d+(?:,\d{3})*|\d+)(?:\s*(k|K|won|KRW|krw))?/g;
  for (const match of input.matchAll(pattern)) {
    const raw = match[0];
    const suffix = match[2];
    const index = match.index ?? 0;
    const before = input.slice(Math.max(0, index - 16), index).toLowerCase();
    const after = input.slice(index + raw.length, index + raw.length + 16).toLowerCase();
    const hasCurrencySignal = raw.includes("₩") || Boolean(suffix) || raw.includes(",") || /\b(paid|total|was|were|cost|split|for)\s*$/i.test(before) || /^\s*(for|between|on)\b/i.test(after);
    if (!hasCurrencySignal) continue;
    matches.push({
      amount: normalizeAmount(match[1], suffix),
      raw,
      index,
      end: index + raw.length,
      hasCurrencySignal
    });
  }
  return matches;
}

function normalizeAmount(raw: string, suffix?: string): number {
  const base = Number(raw.replace(/,/g, ""));
  return suffix?.toLowerCase() === "k" ? base * 1000 : base;
}

function hasExplicitCurrency(input: string): boolean {
  return /₩|won|krw/i.test(input);
}

function extractStatedTotal(input: string, moneyMatches: MoneyMatch[]): number | undefined {
  const total = input.match(/(?:total|overall|all in)\s+(?:was|is|cost)?\s*(?:₩\s*)?(\d+(?:,\d{3})*|\d+)\s*(k|K|won|KRW|krw)?/i);
  if (total) return normalizeAmount(total[1], total[2]);
  const spent = input.match(/(?:we spent|spent)\s+(?:₩\s*)?(\d+(?:,\d{3})*|\d+)\s*(k|K|won|KRW|krw)?/i);
  if (spent) return normalizeAmount(spent[1], spent[2]);
  const split = input.match(/split\s+(?:₩\s*)?(\d+(?:,\d{3})*|\d+)\s*(k|K|won|KRW|krw)?\s+(?:between|among|for)/i);
  if (split) return normalizeAmount(split[1], split[2]);
  if (moneyMatches.length === 1) return moneyMatches[0].amount;
  return undefined;
}

function extractPayers(input: string): ParsedPayer[] {
  const payers: ParsedPayer[] = [];
  const paidPattern = /\b([A-Z][a-z]+|I|i)\s+paid\s+(?:me\s+)?(?:₩\s*)?(\d+(?:,\d{3})*|\d+)\s*(k|K|won|KRW|krw)?(?:\s+(?:upfront|for\s+([^.,]+)))?/g;
  for (const match of input.matchAll(paidPattern)) {
    if (/already paid me/i.test(match[0])) continue;
    payers.push({
      name: normalizePersonName(match[1]),
      amount: normalizeAmount(match[2], match[3]),
      itemLabel: match[4]?.trim()
    });
  }
  if (/\bI paid the rest\b/i.test(input)) payers.push({ name: "Organizer", paysRest: true });
  return payers.length > 0 ? payers : [{ name: "Organizer" }];
}

function extractCredits(input: string): ParsedCredit[] {
  const credits: ParsedCredit[] = [];
  const pattern = /\b([A-Z][a-z]+)\s+already\s+paid\s+me\s+(?:₩\s*)?(\d+(?:,\d{3})*|\d+)\s*(k|K|won|KRW|krw)?/g;
  for (const match of input.matchAll(pattern)) {
    credits.push({
      fromName: match[1],
      toName: "Organizer",
      amount: normalizeAmount(match[2], match[3]),
      note: `${match[1]} already paid Organizer ${formatKrw(normalizeAmount(match[2], match[3]))}.`
    });
  }
  return credits;
}

function extractItems(input: string, payers: ParsedPayer[]): ParsedExpenseItem[] {
  const items = new Map<string, ParsedExpenseItem>();

  const amountForPattern = /(?:₩\s*)?(\d+(?:,\d{3})*|\d+)\s*(k|K|won|KRW|krw)?\s+for\s+([a-z][a-z\s,&]+?)(?=,|\.|$|\s+and\s+(?:₩\s*)?\d)/gi;
  for (const match of input.matchAll(amountForPattern)) {
    const label = cleanItemLabel(match[3]);
    if (!isUsableItemLabel(label)) continue;
    addItem(items, label, normalizeAmount(match[1], match[2]), payerForItem(label, payers), match[0]);
  }

  const paidItemPattern = /\b([A-Z][a-z]+|I|i)\s+paid\s+(?:₩\s*)?(\d+(?:,\d{3})*|\d+)\s*(k|K|won|KRW|krw)?\s+([a-z][a-z\s]{2,24}?)(?=,|\.|$)/g;
  for (const match of input.matchAll(paidItemPattern)) {
    const label = cleanItemLabel(match[4]);
    if (!isUsableItemLabel(label)) continue;
    addItem(items, label, normalizeAmount(match[2], match[3]), normalizePersonName(match[1]), match[0]);
  }

  const segments = input.split(/,(?=\s*[A-Za-z])|[.]/);
  for (const segment of segments) {
    if (/\b\d+\s+(?:people|participants|pax|friends)\b/i.test(segment)) continue;
    if (/\bpaid\b/i.test(segment)) continue;
    const labelAmount = segment.match(/\b([a-z][a-z\s]{1,26}?)\s+(?:was|were|cost|costs)?\s*(?:₩\s*)?(\d+(?:,\d{3})*|\d+)\s*(k|K|won|KRW|krw)?\b/i);
    if (!labelAmount) continue;
    const label = cleanItemLabel(labelAmount[1]);
    if (!isUsableItemLabel(label)) continue;
    addItem(items, label, normalizeAmount(labelAmount[2], labelAmount[3]), payerForItem(label, payers), segment.trim());
  }

  return Array.from(items.values());
}

function addItem(items: Map<string, ParsedExpenseItem>, label: string, amount: number, paidByName?: string, sourceText?: string) {
  const id = slug(label);
  if (items.has(id)) return;
  items.set(id, { id, label: capitalizeWords(label), amount, paidByName, sourceText });
}

function payerForItem(label: string, payers: ParsedPayer[]): string | undefined {
  const matched = payers.find((payer) => payer.itemLabel && labelMatches(label, payer.itemLabel));
  return matched?.name ?? payers.find((payer) => payer.amount && !payer.itemLabel)?.name ?? payers[0]?.name;
}

function extractExclusions(input: string): ParsedExclusion[] {
  const exclusions: ParsedExclusion[] = [];
  const noPattern = /\b([A-Z][a-z]+)\s+(?:doesn't|doesnt|does not|didn't|didnt|did not|skipped|no)\s+(?:eat\s+|had\s+|have\s+)?([a-z]+)/gi;
  for (const match of input.matchAll(noPattern)) {
    exclusions.push({
      participantName: match[1],
      itemLabel: itemLabelFromTerm(match[2]),
      reason: match[0]
    });
  }

  const onlyPattern = /\b([A-Z][a-z]+)\s+only\s+had\s+([a-z]+)/gi;
  for (const match of input.matchAll(onlyPattern)) {
    exclusions.push({
      participantName: match[1],
      onlyIncludedItemLabel: itemLabelFromTerm(match[2]),
      reason: match[0]
    });
  }

  const exceptPattern = /split\s+between\s+everyone\s+except\s+([A-Z][a-z]+)/i;
  const except = input.match(exceptPattern);
  if (except) exclusions.push({ participantName: except[1], reason: except[0] });
  return exclusions;
}

function applyParticipationRules(items: ParsedExpenseItem[], exclusions: ParsedExclusion[], participants: ParsedParticipant[]): ParsedExpenseItem[] {
  return items.map((item) => {
    const excluded = new Set(item.excludedParticipantNames ?? []);
    const included = new Set(item.includedParticipantNames ?? []);

    for (const exclusion of exclusions) {
      if (exclusion.onlyIncludedItemLabel) {
        if (labelMatches(item.label, exclusion.onlyIncludedItemLabel)) included.add(exclusion.participantName);
        else excluded.add(exclusion.participantName);
        continue;
      }
      if (!exclusion.itemLabel || labelMatches(item.label, exclusion.itemLabel)) excluded.add(exclusion.participantName);
    }

    return {
      ...item,
      includedParticipantNames: included.size > 0 ? mergeWithAllParticipants(included, participants) : undefined,
      excludedParticipantNames: excluded.size > 0 ? Array.from(excluded) : undefined
    };
  });
}

function mergeWithAllParticipants(included: Set<string>, participants: ParsedParticipant[]): string[] {
  const names = new Set(participants.map((participant) => participant.name));
  for (const name of included) names.add(name);
  return Array.from(names);
}

export function labelMatches(label: string, query: string): boolean {
  const normalizedLabel = label.toLowerCase();
  const normalizedQuery = query.toLowerCase();
  if (normalizedLabel.includes(normalizedQuery) || normalizedQuery.includes(normalizedLabel)) return true;
  return Object.values(knownItemAliases).some((aliases) => aliases.includes(normalizedQuery) && aliases.some((alias) => normalizedLabel.includes(alias)));
}

function itemLabelFromTerm(term: string): string {
  const normalized = term.toLowerCase();
  for (const [label, aliases] of Object.entries(knownItemAliases)) {
    if (aliases.includes(normalized)) return label;
  }
  return normalized;
}

function inferDefaultPayer(payers: ParsedPayer[]): string {
  return payers.find((payer) => !payer.paysRest)?.name ?? "Organizer";
}

function normalizePersonName(name: string): string {
  return /^i$/i.test(name) ? "Organizer" : name;
}

function cleanItemLabel(label: string): string {
  return label
    .replace(/\b(i|we|ali|sarah|adam|organizer|paid|total|was|were|cost|costs|split|between|for|and)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUsableItemLabel(label: string): boolean {
  if (!label || label.length < 3) return false;
  return !/\b(people|participants|upfront|rest|won|krw|total|paid|split)\b/i.test(label);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replace("_", " ");
}

function capitalizeWords(value: string): string {
  return value.split(/\s+/).map(capitalize).join(" ");
}
