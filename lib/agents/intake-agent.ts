import type { IntakeResult } from "@/lib/agents/agent-types";
import { getModelForAgent } from "@/lib/ai/model-policy";
import type { ExpenseType, SplitMethod, SplitParticipantInput } from "@/lib/domain/proposal-types";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "participant";
}

function extractAmount(message: string): number | undefined {
  const markedAmounts = [...message.matchAll(/(?:₩|krw\s*)(\d[\d,]*)|(\d[\d,]*)\s*(?:won|krw)/gi)].map((match) =>
    Number((match[1] ?? match[2]).replace(/,/g, ""))
  );
  if (markedAmounts.length === 1) return markedAmounts[0];
  if (markedAmounts.length > 1) return markedAmounts.reduce((sum, amount) => sum + amount, 0);

  const unmarked = [...message.matchAll(/\b(\d[\d,]*)\b/g)]
    .map((match) => ({ value: Number(match[1].replace(/,/g, "")), index: match.index ?? 0 }))
    .find((match) => {
      const after = message.slice(match.index, match.index + 24);
      return match.value >= 1000 && !/(people|participants|friends|members|night)/i.test(after);
    });
  return unmarked?.value;
}

function extractParticipantCount(message: string): number | undefined {
  const match = message.match(/(?:between|for|among|with)\s+(\d+)\s+(?:people|participants|friends|members)/i);
  if (match) return Number(match[1]);
  const shorthand = message.match(/\b(?:for|between|among|with)\s+(\d+)(?:\.|,|$)/i);
  if (!shorthand) return undefined;
  const count = Number(shorthand[1]);
  return count > 0 && count <= 50 ? count : undefined;
}

function inferExpenseType(message: string): ExpenseType {
  if (/airbnb|hotel|stay|trip|travel|night/i.test(message)) return "travel_accommodation";
  if (/dinner|meal|lunch|breakfast|restaurant/i.test(message)) return "meal";
  if (/gift/i.test(message)) return "gift";
  if (/subscription|netflix|spotify/i.test(message)) return "subscription";
  if (/bill|rent|utility|electric/i.test(message)) return "bill";
  return "general";
}

function inferExplicitMethod(message: string): SplitMethod | undefined {
  if (/equally|equal split|split equally/i.test(message)) return "equal";
  if (/%|percent|percentage/i.test(message)) return "percentage";
  if (/fixed|pays\s+₩?\d|pays\s+\d/i.test(message)) return "fixed";
  if (/night|usage|weight|room size|joined late/i.test(message)) return "weighted";
  return undefined;
}

function extractNamedNightParticipant(message: string): { name: string; nights: number } | undefined {
  const match = message.match(/\b([A-Z][a-z]+)\s+stays?\s+(\d+)\s+night/i);
  return match ? { name: match[1], nights: Number(match[2]) } : undefined;
}

function extractEveryoneElseNights(message: string): number | undefined {
  const match = message.match(/everyone else\s+stays?\s+(\d+)\s+night/i);
  return match ? Number(match[1]) : undefined;
}

function extractFixedPayer(message: string): { name: string; amount: number } | undefined {
  const match = message.match(/\b([A-Z][a-z]+)\s+pays?\s+₩?(\d[\d,]*)\s+fixed/i);
  return match ? { name: match[1], amount: Number(match[2].replace(/,/g, "")) } : undefined;
}

function buildParticipants(message: string): SplitParticipantInput[] {
  const count = extractParticipantCount(message);
  if (!count || count <= 0) return [];

  const namedNightParticipant = extractNamedNightParticipant(message);
  const everyoneElseNights = extractEveryoneElseNights(message);
  const fixedPayer = extractFixedPayer(message);
  const participants: SplitParticipantInput[] = [];

  if (namedNightParticipant) {
    participants.push({
      id: slug(namedNightParticipant.name),
      name: namedNightParticipant.name,
      weight: namedNightParticipant.nights,
      metadata: { nights: namedNightParticipant.nights }
    });
  } else if (fixedPayer) {
    participants.push({
      id: slug(fixedPayer.name),
      name: fixedPayer.name,
      fixedAmount: fixedPayer.amount
    });
  }

  for (let index = participants.length + 1; index <= count; index += 1) {
    const nights = everyoneElseNights ?? 1;
    participants.push({
      id: `participant-${index}`,
      name: `Participant ${index}`,
      weight: namedNightParticipant ? nights : undefined,
      metadata: namedNightParticipant ? { nights } : undefined
    });
  }

  return participants;
}

function extractCostItems(message: string, totalAmount?: number): Array<{ label: string; amount: number }> {
  if (!totalAmount) return [];
  const label = /airbnb/i.test(message)
    ? "Airbnb"
    : /dinner/i.test(message)
      ? "Dinner"
      : /gift/i.test(message)
        ? "Group gift"
        : "Shared expense";
  return [{ label, amount: totalAmount }];
}

export function runIntakeAgent(message: string): IntakeResult {
  const totalAmount = extractAmount(message);
  const participants = buildParticipants(message);
  const missingFields: IntakeResult["missingFields"] = [];

  if (totalAmount === undefined) missingFields.push("totalAmount");
  if (participants.length === 0) missingFields.push("participants");

  return {
    model: getModelForAgent("Intake Agent"),
    expenseType: inferExpenseType(message),
    totalAmount,
    currency: "KRW",
    participants,
    explicitMethod: inferExplicitMethod(message),
    costItems: extractCostItems(message, totalAmount),
    constraints: [
      ...(/night/i.test(message) ? ["Different stay duration"] : []),
      ...(/opt out/i.test(message) ? ["Participants may opt out"] : []),
      ...(/fixed/i.test(message) ? ["Fixed contribution mentioned"] : [])
    ],
    missingFields,
    sourceText: message
  };
}
