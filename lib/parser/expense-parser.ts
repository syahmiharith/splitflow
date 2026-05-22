import { buildClarificationQuestions } from "@/lib/parser/clarification";
import { formatKrw, normalizeExpenseDraft } from "@/lib/parser/expense-normalizer";
import { validateExpenseDraft } from "@/lib/parser/expense-validator";
import type { ParserResult } from "@/lib/parser/expense-types";

export function parseExpensePrompt(input: string): ParserResult {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 6) {
    return {
      status: "unsupported",
      confidence: "low",
      issues: [{ code: "unsupported", severity: "blocking", message: "The request is too short to identify a group expense." }],
      clarificationQuestions: [],
      normalizedSummary: "Please describe a group expense with an amount and participants."
    };
  }

  const draft = normalizeExpenseDraft(trimmed);
  const validation = validateExpenseDraft(draft);
  const clarificationQuestions = buildClarificationQuestions(validation.issues);
  const blocking = validation.issues.some((issue) => issue.severity === "blocking");
  const hasAnyMoney = Boolean(draft.statedTotal) || draft.items.some((item) => item.amount);

  if (!hasAnyMoney) {
    return {
      status: "unsupported",
      draft,
      confidence: "low",
      issues: validation.issues,
      clarificationQuestions,
      normalizedSummary: "I can parse totals, itemized costs, participants, payers, exclusions, and simple credits. I could not find enough money information in this prompt."
    };
  }

  return {
    status: blocking ? "needs_clarification" : "ready",
    draft,
    confidence: validation.confidence,
    issues: validation.issues,
    clarificationQuestions,
    normalizedSummary: summarizeDraft(draft)
  };
}

function summarizeDraft(draft: NonNullable<ParserResult["draft"]>): string {
  const total = draft.statedTotal ?? draft.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
  const itemList = draft.items.map((item) => `${item.label} ${formatKrw(item.amount ?? 0)}`).join(", ");
  return `${draft.title}: ${formatKrw(total)} across ${draft.participants.length} participants${itemList ? ` (${itemList})` : ""}.`;
}
