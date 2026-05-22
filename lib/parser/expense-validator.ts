import { formatKrw, labelMatches } from "@/lib/parser/expense-normalizer";
import type { ParsedExpenseDraft, ParserConfidence, ParserValidationIssue } from "@/lib/parser/expense-types";

export type ExpenseValidationResult = {
  issues: ParserValidationIssue[];
  confidence: ParserConfidence;
};

export function validateExpenseDraft(draft: ParsedExpenseDraft): ExpenseValidationResult {
  const issues: ParserValidationIssue[] = [];
  const itemTotal = draft.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);

  if (!draft.statedTotal && itemTotal === 0) {
    issues.push({ code: "missing_amount", severity: "blocking", message: "I could not find a total amount or itemized costs." });
  }
  if (draft.participants.length < 2) {
    issues.push({ code: "missing_participants", severity: "blocking", message: "I need at least two participants to create a split proposal." });
  }
  if (draft.statedTotal && itemTotal > 0 && draft.statedTotal !== itemTotal) {
    issues.push({
      code: "total_mismatch",
      severity: "blocking",
      message: `I found ${formatKrw(draft.statedTotal)} total, but the itemized costs add up to ${formatKrw(itemTotal)}.`
    });
  }

  for (const exclusion of draft.exclusions) {
    if (!draft.participants.some((participant) => participant.name === exclusion.participantName)) {
      issues.push({ code: "unknown_exclusion_target", severity: "blocking", message: `${exclusion.participantName} was mentioned in a split rule but is not in the participant list.` });
    }
    const targetLabel = exclusion.itemLabel ?? exclusion.onlyIncludedItemLabel;
    if (targetLabel && !draft.items.some((item) => labelMatches(item.label, targetLabel))) {
      issues.push({ code: "unknown_exclusion_target", severity: "blocking", message: `${exclusion.participantName}'s rule references ${targetLabel}, but I could not map that to an item.` });
    }
  }

  const singleAmountMultiItem = draft.items.some((item) => item.label.includes(",") || /\band\b/i.test(item.label));
  if (singleAmountMultiItem && draft.exclusions.length > 0) {
    issues.push({
      code: "ambiguous_item_amounts",
      severity: "blocking",
      message: "Some items were grouped under one amount, but participant rules apply to one item inside that group."
    });
  }

  const payerAmountTotal = draft.payers.reduce((sum, payer) => sum + (payer.amount ?? 0), 0);
  if (payerAmountTotal > 0 && itemTotal > 0 && payerAmountTotal !== itemTotal && !draft.payers.some((payer) => payer.paysRest)) {
    issues.push({
      code: "payer_mismatch",
      severity: "warning",
      message: `Payer amounts add up to ${formatKrw(payerAmountTotal)}, while item costs add up to ${formatKrw(itemTotal)}.`
    });
  }

  const blocking = issues.some((issue) => issue.severity === "blocking");
  const generatedNames = draft.participants.some((participant) => participant.generated);
  const confidence: ParserConfidence = blocking ? "low" : generatedNames || issues.length > 0 || draft.assumptions.length > 0 ? "medium" : "high";
  return { issues, confidence };
}
